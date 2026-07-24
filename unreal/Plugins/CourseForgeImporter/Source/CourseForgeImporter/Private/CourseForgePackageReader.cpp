#include "CourseForgePackageReader.h"

#include "Containers/StringConv.h"
#include "Dom/JsonObject.h"
#include "FileUtilities/ZipArchiveReader.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/OutputDeviceNull.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
    constexpr uint8 PngSignature[] = { 137, 80, 78, 71, 13, 10, 26, 10 };

    bool Fail(FString& OutError, const FString& Message)
    {
        OutError = Message;
        return false;
    }

    bool IsSafeArtifactPath(const FString& Path)
    {
        return !Path.IsEmpty()
            && FPaths::IsRelative(Path)
            && !Path.StartsWith(TEXT("/"))
            && !Path.Contains(TEXT(".."));
    }

    uint32 ReadBigEndianU32(const uint8* Bytes)
    {
        return (static_cast<uint32>(Bytes[0]) << 24)
            | (static_cast<uint32>(Bytes[1]) << 16)
            | (static_cast<uint32>(Bytes[2]) << 8)
            | static_cast<uint32>(Bytes[3]);
    }

    bool ReadRequiredString(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, FString& OutValue, FString& OutError)
    {
        if (!Object->TryGetStringField(FieldName, OutValue) || OutValue.IsEmpty())
        {
            return Fail(OutError, FString::Printf(TEXT("Missing required string field '%s'."), FieldName));
        }

        return true;
    }

    bool ReadPositiveInt(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, int32& OutValue, FString& OutError)
    {
        double Number = 0.0;
        if (!Object->TryGetNumberField(FieldName, Number) || Number <= 0.0 || Number > MAX_int32)
        {
            return Fail(OutError, FString::Printf(TEXT("Field '%s' must be a positive integer."), FieldName));
        }

        OutValue = static_cast<int32>(Number);
        if (static_cast<double>(OutValue) != Number)
        {
            return Fail(OutError, FString::Printf(TEXT("Field '%s' must be a positive integer."), FieldName));
        }

        return true;
    }

    bool ReadArtifact(const TSharedPtr<FJsonObject>& Object, FCourseForgeArtifact& OutArtifact, FString& OutError)
    {
        const TSharedPtr<FJsonObject>* ArtifactObject = nullptr;
        if (!Object->TryGetObjectField(TEXT("artifact"), ArtifactObject) || !ArtifactObject || !ArtifactObject->IsValid())
        {
            return Fail(OutError, TEXT("Missing required artifact descriptor."));
        }

        if (!ReadRequiredString(*ArtifactObject, TEXT("path"), OutArtifact.Path, OutError))
        {
            return false;
        }

        if (!IsSafeArtifactPath(OutArtifact.Path))
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact path '%s' is not a safe relative path."), *OutArtifact.Path));
        }

        double ByteLength = 0.0;
        if (!(*ArtifactObject)->TryGetNumberField(TEXT("byteLength"), ByteLength) || ByteLength <= 0.0 || ByteLength > MAX_int64)
        {
            return Fail(OutError, TEXT("Artifact byteLength must be a positive integer."));
        }

        OutArtifact.ByteLength = static_cast<int64>(ByteLength);
        if (static_cast<double>(OutArtifact.ByteLength) != ByteLength)
        {
            return Fail(OutError, TEXT("Artifact byteLength must be a positive integer."));
        }

        return ReadRequiredString(*ArtifactObject, TEXT("sha256"), OutArtifact.Sha256, OutError);
    }

    bool ReadArtifactBytes(FZipArchiveReader& Archive, const FCourseForgeArtifact& Artifact, TArray<uint8>& OutBytes, FString& OutError)
    {
        FOutputDeviceNull ErrorSink;
        if (!Archive.TryReadFile(Artifact.Path, OutBytes, &ErrorSink, nullptr))
        {
            return Fail(OutError, FString::Printf(TEXT("Bundle does not contain readable artifact '%s'. CourseForge bundles must use ZIP store entries."), *Artifact.Path));
        }

        if (OutBytes.Num() != Artifact.ByteLength)
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact '%s' has %d bytes; manifest declares %lld."), *Artifact.Path, OutBytes.Num(), Artifact.ByteLength));
        }

        return true;
    }

    bool ValidateGrayscalePng(const TArray<uint8>& Bytes, int32 ExpectedWidth, int32 ExpectedHeight, uint8 ExpectedBitDepth, const FString& ArtifactPath, FString& OutError)
    {
        // PNG signature + IHDR chunk header + IHDR data through color type.
        if (Bytes.Num() < 26 || FMemory::Memcmp(Bytes.GetData(), PngSignature, UE_ARRAY_COUNT(PngSignature)) != 0)
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact '%s' is not a PNG file."), *ArtifactPath));
        }

        const uint8* Header = Bytes.GetData();
        if (FMemory::Memcmp(Header + 12, "IHDR", 4) != 0)
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact '%s' has no PNG IHDR header."), *ArtifactPath));
        }

        const uint32 Width = ReadBigEndianU32(Header + 16);
        const uint32 Height = ReadBigEndianU32(Header + 20);
        const uint8 BitDepth = Header[24];
        const uint8 ColorType = Header[25];
        if (Width != static_cast<uint32>(ExpectedWidth) || Height != static_cast<uint32>(ExpectedHeight))
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact '%s' dimensions do not match its manifest descriptor."), *ArtifactPath));
        }

        if (BitDepth != ExpectedBitDepth || ColorType != 0)
        {
            return Fail(OutError, FString::Printf(TEXT("Artifact '%s' must be a %d-bit grayscale PNG."), *ArtifactPath, ExpectedBitDepth));
        }

        return true;
    }

    bool ParseManifest(const TArray<uint8>& ManifestBytes, TSharedPtr<FJsonObject>& OutRoot, FString& OutError)
    {
        const FUTF8ToTCHAR Text(reinterpret_cast<const ANSICHAR*>(ManifestBytes.GetData()), ManifestBytes.Num());
        const FString ManifestText(Text.Length(), Text.Get());
        const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ManifestText);
        if (!FJsonSerializer::Deserialize(Reader, OutRoot) || !OutRoot.IsValid())
        {
            return Fail(OutError, TEXT("course-package.json is not valid JSON."));
        }

        return true;
    }

    bool ReadLocalGrid(const TSharedPtr<FJsonObject>& HeightmapObject, TOptional<FCourseForgeLocalGrid>& OutGrid, FString& OutError)
    {
        const TSharedPtr<FJsonObject>* LocalGridObject = nullptr;
        if (!HeightmapObject->TryGetObjectField(TEXT("localGrid"), LocalGridObject))
        {
            return true;
        }

        if (!LocalGridObject || !LocalGridObject->IsValid())
        {
            return Fail(OutError, TEXT("heightmap.localGrid must be an object when present."));
        }

        FCourseForgeLocalGrid LocalGrid;
        if (!(*LocalGridObject)->TryGetNumberField(TEXT("originLat"), LocalGrid.OriginLat)
            || !(*LocalGridObject)->TryGetNumberField(TEXT("originLng"), LocalGrid.OriginLng)
            || !(*LocalGridObject)->TryGetNumberField(TEXT("widthMeters"), LocalGrid.WidthMeters)
            || !(*LocalGridObject)->TryGetNumberField(TEXT("heightMeters"), LocalGrid.HeightMeters)
            || !(*LocalGridObject)->TryGetNumberField(TEXT("metersPerPixelX"), LocalGrid.MetersPerPixelX)
            || !(*LocalGridObject)->TryGetNumberField(TEXT("metersPerPixelY"), LocalGrid.MetersPerPixelY)
            || LocalGrid.WidthMeters <= 0.0
            || LocalGrid.HeightMeters <= 0.0
            || LocalGrid.MetersPerPixelX <= 0.0
            || LocalGrid.MetersPerPixelY <= 0.0)
        {
            return Fail(OutError, TEXT("heightmap.localGrid is incomplete or has non-positive metric dimensions."));
        }

        OutGrid = MoveTemp(LocalGrid);
        return true;
    }
}

bool FCourseForgePackageReader::ReadBundle(const FString& BundlePath, FCourseForgePackage& OutPackage, FString& OutError)
{
    OutPackage = FCourseForgePackage();
    OutError.Reset();

    IPlatformFile& PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
    TUniquePtr<IFileHandle> BundleHandle(PlatformFile.OpenRead(*BundlePath));
    if (!BundleHandle.IsValid())
    {
        return Fail(OutError, FString::Printf(TEXT("Cannot open CourseForge bundle '%s'."), *BundlePath));
    }

    FOutputDeviceNull ErrorSink;
    // FZipArchiveReader owns and deletes the handle it receives.
    FZipArchiveReader Archive(BundleHandle.Release(), &ErrorSink);
    if (!Archive.IsValid())
    {
        return Fail(OutError, TEXT("Bundle is not a readable uncompressed ZIP archive."));
    }

    TArray<uint8> ManifestBytes;
    if (!Archive.TryReadFile(TEXT("course-package.json"), ManifestBytes, &ErrorSink, nullptr))
    {
        return Fail(OutError, TEXT("Bundle is missing course-package.json."));
    }

    TSharedPtr<FJsonObject> Root;
    if (!ParseManifest(ManifestBytes, Root, OutError)
        || !ReadRequiredString(Root, TEXT("packageVersion"), OutPackage.PackageVersion, OutError))
    {
        return false;
    }

    if (OutPackage.PackageVersion != TEXT("0.1.0"))
    {
        return Fail(OutError, FString::Printf(TEXT("Unsupported CoursePackage version '%s'."), *OutPackage.PackageVersion));
    }

    const TSharedPtr<FJsonObject>* CourseObject = nullptr;
    if (!Root->TryGetObjectField(TEXT("course"), CourseObject) || !CourseObject || !CourseObject->IsValid()
        || !ReadRequiredString(*CourseObject, TEXT("name"), OutPackage.CourseName, OutError))
    {
        return false;
    }

    const TSharedPtr<FJsonObject>* ElevationObject = nullptr;
    if (Root->TryGetObjectField(TEXT("elevation"), ElevationObject) && ElevationObject && ElevationObject->IsValid())
    {
        const TSharedPtr<FJsonObject>* HeightmapObject = nullptr;
        if ((*ElevationObject)->TryGetObjectField(TEXT("heightmap"), HeightmapObject) && HeightmapObject && HeightmapObject->IsValid())
        {
            FCourseForgeHeightmap Heightmap;
            FString Format;
            if (!ReadRequiredString(*HeightmapObject, TEXT("format"), Format, OutError))
            {
                return false;
            }

            if (Format != TEXT("png-16"))
            {
                return Fail(OutError, TEXT("CoursePackage heightmap must use png-16."));
            }

            if (!ReadPositiveInt(*HeightmapObject, TEXT("width"), Heightmap.Width, OutError)
                || !ReadPositiveInt(*HeightmapObject, TEXT("height"), Heightmap.Height, OutError)
                || !(*HeightmapObject)->TryGetNumberField(TEXT("metersPerPixel"), Heightmap.MetersPerPixel)
                || !(*HeightmapObject)->TryGetNumberField(TEXT("minElevationMeters"), Heightmap.MinElevationMeters)
                || !(*HeightmapObject)->TryGetNumberField(TEXT("maxElevationMeters"), Heightmap.MaxElevationMeters)
                || Heightmap.MetersPerPixel <= 0.0
                || Heightmap.MinElevationMeters > Heightmap.MaxElevationMeters
                || !ReadLocalGrid(*HeightmapObject, Heightmap.LocalGrid, OutError)
                || !ReadArtifact(*HeightmapObject, Heightmap.Artifact, OutError)
                || !ReadArtifactBytes(Archive, Heightmap.Artifact, Heightmap.PngBytes, OutError)
                || !ValidateGrayscalePng(Heightmap.PngBytes, Heightmap.Width, Heightmap.Height, 16, Heightmap.Artifact.Path, OutError))
            {
                return false;
            }

            OutPackage.Heightmap = MoveTemp(Heightmap);
        }
    }

    const TSharedPtr<FJsonObject>* SurfacesObject = nullptr;
    if (Root->TryGetObjectField(TEXT("surfaces"), SurfacesObject) && SurfacesObject && SurfacesObject->IsValid())
    {
        FString Format;
        if (!ReadRequiredString(*SurfacesObject, TEXT("format"), Format, OutError))
        {
            return false;
        }

        if (Format != TEXT("png-8"))
        {
            return Fail(OutError, TEXT("CoursePackage surfaces must use png-8."));
        }

        int32 SurfaceWidth = 0;
        int32 SurfaceHeight = 0;
        if (!ReadPositiveInt(*SurfacesObject, TEXT("width"), SurfaceWidth, OutError)
            || !ReadPositiveInt(*SurfacesObject, TEXT("height"), SurfaceHeight, OutError))
        {
            return false;
        }

        if (OutPackage.Heightmap.IsSet() && (SurfaceWidth != OutPackage.Heightmap->Width || SurfaceHeight != OutPackage.Heightmap->Height))
        {
            return Fail(OutError, TEXT("Surface-map dimensions must match the heightmap grid."));
        }

        const TArray<TSharedPtr<FJsonValue>>* Layers = nullptr;
        if (!(*SurfacesObject)->TryGetArrayField(TEXT("layers"), Layers) || !Layers || Layers->IsEmpty())
        {
            return Fail(OutError, TEXT("CoursePackage surfaces must contain at least one layer."));
        }

        for (const TSharedPtr<FJsonValue>& LayerValue : *Layers)
        {
            const TSharedPtr<FJsonObject> LayerObject = LayerValue.IsValid() ? LayerValue->AsObject() : nullptr;
            if (!LayerObject.IsValid())
            {
                return Fail(OutError, TEXT("CoursePackage surfaces contains an invalid layer."));
            }

            FCourseForgeSurfaceLayer Layer;
            if (!ReadRequiredString(LayerObject, TEXT("name"), Layer.Name, OutError)
                || !ReadArtifact(LayerObject, Layer.Artifact, OutError)
                || !ReadArtifactBytes(Archive, Layer.Artifact, Layer.PngBytes, OutError)
                || !ValidateGrayscalePng(Layer.PngBytes, SurfaceWidth, SurfaceHeight, 8, Layer.Artifact.Path, OutError))
            {
                return false;
            }

            OutPackage.SurfaceLayers.Add(MoveTemp(Layer));
        }
    }

    return true;
}
