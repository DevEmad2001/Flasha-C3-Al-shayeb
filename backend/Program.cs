using AlShaibHousing.Api;

var builder = WebApplication.CreateBuilder(args);
ProgramSetup.ConfigureServices(builder);

var app = builder.Build();
await ProgramSetup.ConfigurePipeline(app);

app.Run();
