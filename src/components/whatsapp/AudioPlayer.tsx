import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  isFromMe?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isFromMe = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * duration;
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    
    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 min-w-[200px] max-w-[280px]",
      isFromMe ? "text-white" : "text-foreground"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full shrink-0",
          isFromMe 
            ? "bg-white/20 hover:bg-white/30 text-white" 
            : "bg-emerald-500 hover:bg-emerald-600 text-white"
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" fill="currentColor" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Progress Bar */}
        <div 
          className={cn(
            "h-1.5 rounded-full cursor-pointer relative overflow-hidden",
            isFromMe ? "bg-white/30" : "bg-slate-200"
          )}
          onClick={handleProgressClick}
        >
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-100",
              isFromMe ? "bg-white" : "bg-emerald-500"
            )}
            style={{ width: `${progress}%` }}
          />
          {/* Waveform visual (static bars for aesthetic) */}
          <div className="absolute inset-0 flex items-center justify-around pointer-events-none opacity-50">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-0.5 rounded-full",
                  isFromMe ? "bg-white/50" : "bg-slate-400"
                )}
                style={{
                  height: `${Math.sin(i * 0.5) * 50 + 50}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Time and Speed */}
        <div className="flex items-center justify-between text-[10px]">
          <span className={isFromMe ? "text-white/70" : "text-muted-foreground"}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            onClick={cyclePlaybackRate}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
              isFromMe 
                ? "bg-white/20 hover:bg-white/30 text-white" 
                : "bg-slate-100 hover:bg-slate-200 text-muted-foreground"
            )}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
