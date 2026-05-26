import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Required for WebGL (MapLibre) renders
Config.setChromiumOpenGlRenderer("angle");
