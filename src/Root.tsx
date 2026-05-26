import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { ArticleHighlight } from "./ArticleHighlight";
import { TravelMap } from "./TravelMap";
import { RunStory, calculateRunStoryMetadata } from "./RunStory";
import type { RunStoryProps } from "./RunStory";

export const Root: React.FC = () => (
  <>
    <Composition
      id="ArticleHighlight"
      component={ArticleHighlight}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="TravelMap"
      component={TravelMap}
      durationInFrames={360}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="RunStory"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={RunStory as React.FC<any>}
      calculateMetadata={
        calculateRunStoryMetadata as CalculateMetadataFunction<
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >
      }
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={
        {
          coordinates: [],
          frameToTrackIndex: [],
          frameMetrics: [],
          totalDistanceKm: 0,
          totalDurationMs: 0,
          runName: "Run",
          runDate: "",
        } as RunStoryProps
      }
    />
  </>
);
