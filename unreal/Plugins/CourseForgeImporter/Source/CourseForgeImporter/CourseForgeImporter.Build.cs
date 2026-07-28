using UnrealBuildTool;

public class CourseForgeImporter : ModuleRules
{
    public CourseForgeImporter(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new[]
        {
            "Core"
        });

        PrivateDependencyModuleNames.AddRange(new[]
        {
            "CoreUObject",
            "Engine",
            "FileUtilities",
            "Json",
            "JsonUtilities"
        });

        AddEngineThirdPartyPrivateStaticDependencies(Target, "OpenSSL");
    }
}
