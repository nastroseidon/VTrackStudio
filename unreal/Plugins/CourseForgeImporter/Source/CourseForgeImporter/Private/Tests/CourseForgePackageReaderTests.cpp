#if WITH_DEV_AUTOMATION_TESTS

#include "CourseForgePackageReader.h"
#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

namespace
{
    struct FStoredZipEntry
    {
        TArray<uint8> Name;
        TArray<uint8> Data;
        uint32 Crc32 = 0;
        uint32 LocalHeaderOffset = 0;
    };

    void AppendU16(TArray<uint8>& Out, uint16 Value)
    {
        Out.Add(static_cast<uint8>(Value & 0xff));
        Out.Add(static_cast<uint8>((Value >> 8) & 0xff));
    }

    void AppendU32(TArray<uint8>& Out, uint32 Value)
    {
        AppendU16(Out, static_cast<uint16>(Value & 0xffff));
        AppendU16(Out, static_cast<uint16>((Value >> 16) & 0xffff));
    }

    uint32 CalculateCrc32(const TArray<uint8>& Data)
    {
        uint32 Crc = 0xffffffff;
        for (const uint8 Byte : Data)
        {
            Crc ^= Byte;
            for (int32 Bit = 0; Bit < 8; ++Bit)
            {
                Crc = (Crc >> 1) ^ ((Crc & 1) != 0 ? 0xedb88320 : 0);
            }
        }

        return ~Crc;
    }

    TArray<uint8> Utf8Bytes(const FString& Text)
    {
        FTCHARToUTF8 Utf8(*Text);
        TArray<uint8> Bytes;
        Bytes.Append(reinterpret_cast<const uint8*>(Utf8.Get()), Utf8.Length());
        return Bytes;
    }

    void AppendStoredEntry(TArray<uint8>& Out, FStoredZipEntry& Entry)
    {
        Entry.LocalHeaderOffset = Out.Num();
        AppendU32(Out, 0x04034b50);
        AppendU16(Out, 20);
        AppendU16(Out, 0);
        AppendU16(Out, 0); // Store method: CourseForge bundles are intentionally uncompressed.
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU32(Out, Entry.Crc32);
        AppendU32(Out, Entry.Data.Num());
        AppendU32(Out, Entry.Data.Num());
        AppendU16(Out, Entry.Name.Num());
        AppendU16(Out, 0);
        Out.Append(Entry.Name);
        Out.Append(Entry.Data);
    }

    void AppendCentralDirectoryEntry(TArray<uint8>& Out, const FStoredZipEntry& Entry)
    {
        AppendU32(Out, 0x02014b50);
        AppendU16(Out, 20);
        AppendU16(Out, 20);
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU32(Out, Entry.Crc32);
        AppendU32(Out, Entry.Data.Num());
        AppendU32(Out, Entry.Data.Num());
        AppendU16(Out, Entry.Name.Num());
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU16(Out, 0);
        AppendU32(Out, 0);
        AppendU32(Out, Entry.LocalHeaderOffset);
        Out.Append(Entry.Name);
    }

    bool WriteStoredBundleFixture(const FString& BundlePath)
    {
        const FString Manifest = TEXT(R"json({
          "packageVersion": "0.1.0",
          "course": { "name": "Reader Fixture" },
          "elevation": {
            "heightmap": {
              "format": "png-16",
              "width": 1,
              "height": 1,
              "metersPerPixel": 1,
              "minElevationMeters": 10,
              "maxElevationMeters": 20,
              "localGrid": {
                "originLat": 40,
                "originLng": -80,
                "widthMeters": 1,
                "heightMeters": 1,
                "metersPerPixelX": 1,
                "metersPerPixelY": 1
              },
              "artifact": {
                "path": "elevation/heightmap.png",
                "byteLength": 29,
                "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
              }
            }
          },
          "surfaces": {
            "format": "png-8",
            "width": 1,
            "height": 1,
            "layers": [{
              "name": "fairway",
              "artifact": {
                "path": "surfaces/fairway.png",
                "byteLength": 29,
                "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
              }
            }]
          }
        })json");

        const uint8 PngHeader[] = {
            137, 80, 78, 71, 13, 10, 26, 10,
            0, 0, 0, 13, 'I', 'H', 'D', 'R',
            0, 0, 0, 1, 0, 0, 0, 1,
            16, 0, 0, 0, 0
        };

        TArray<FStoredZipEntry> Entries;
        Entries.Add({ Utf8Bytes(TEXT("course-package.json")), Utf8Bytes(Manifest) });
        Entries.Add({ Utf8Bytes(TEXT("elevation/heightmap.png")), TArray<uint8>(PngHeader, UE_ARRAY_COUNT(PngHeader)) });
        TArray<uint8> SurfacePng(PngHeader, UE_ARRAY_COUNT(PngHeader));
        SurfacePng[24] = 8;
        Entries.Add({ Utf8Bytes(TEXT("surfaces/fairway.png")), MoveTemp(SurfacePng) });

        for (FStoredZipEntry& Entry : Entries)
        {
            Entry.Crc32 = CalculateCrc32(Entry.Data);
        }

        TArray<uint8> ZipBytes;
        for (FStoredZipEntry& Entry : Entries)
        {
            AppendStoredEntry(ZipBytes, Entry);
        }

        const uint32 CentralDirectoryOffset = ZipBytes.Num();
        for (const FStoredZipEntry& Entry : Entries)
        {
            AppendCentralDirectoryEntry(ZipBytes, Entry);
        }

        const uint32 CentralDirectorySize = ZipBytes.Num() - CentralDirectoryOffset;
        AppendU32(ZipBytes, 0x06054b50);
        AppendU16(ZipBytes, 0);
        AppendU16(ZipBytes, 0);
        AppendU16(ZipBytes, Entries.Num());
        AppendU16(ZipBytes, Entries.Num());
        AppendU32(ZipBytes, CentralDirectorySize);
        AppendU32(ZipBytes, CentralDirectoryOffset);
        AppendU16(ZipBytes, 0);

        return FFileHelper::SaveArrayToFile(ZipBytes, *BundlePath);
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FCourseForgePackageReaderTest,
    "CourseForgeImporter.PackageReader.ReadStoredBundle",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FCourseForgePackageReaderTest::RunTest(const FString& Parameters)
{
    const FString BundlePath = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("CourseForgePackageReaderFixture.zip"));
    TestTrue(TEXT("Writes a deterministic stored ZIP fixture"), WriteStoredBundleFixture(BundlePath));

    FCourseForgePackage Package;
    FString Error;
    TestTrue(TEXT("Reads the stored CourseForge bundle"), FCourseForgePackageReader::ReadBundle(BundlePath, Package, Error));
    TestEqual(TEXT("Reads the package version"), Package.PackageVersion, FString(TEXT("0.1.0")));
    TestEqual(TEXT("Reads the course name"), Package.CourseName, FString(TEXT("Reader Fixture")));
    TestTrue(TEXT("Reads the heightmap"), Package.Heightmap.IsSet());
    if (Package.Heightmap.IsSet())
    {
        TestEqual(TEXT("Reads heightmap width"), Package.Heightmap->Width, 1);
        TestEqual(TEXT("Reads heightmap height"), Package.Heightmap->Height, 1);
        TestTrue(TEXT("Reads local metric placement"), Package.Heightmap->LocalGrid.IsSet());
    }

    TestEqual(TEXT("Reads one surface layer"), Package.SurfaceLayers.Num(), 1);
    if (Package.SurfaceLayers.Num() == 1)
    {
        TestEqual(TEXT("Reads the surface-layer name"), Package.SurfaceLayers[0].Name, FString(TEXT("fairway")));
    }

    IFileManager::Get().Delete(*BundlePath, false, true, true);
    return true;
}

#endif
