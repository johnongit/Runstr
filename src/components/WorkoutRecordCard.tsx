import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Clock, MapPin, Calendar, TrendingUp, Timer, MoreHorizontal } from "lucide-react";

interface WorkoutMetric {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}

interface WorkoutCardProps {
  author: {
    name: string;
    username?: string;
    avatar?: string;
    timeAgo: string;
  };
  workout: {
    title: string;
    content: string;
    timestamp: string;
    location?: string;
    date?: string;
  };
  metrics?: WorkoutMetric[];
  engagement?: {
    zaps: number;
    isZapped?: boolean;
  };
  onZap?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  className?: string;
}

export function WorkoutCard({
  author,
  workout,
  metrics = [],
  engagement = { zaps: 0 },
  onZap,
  onComment,
  onShare,
  onMore,
  className
}: WorkoutCardProps) {
  const [isZapped, setIsZapped] = useState(engagement?.isZapped ?? false);
  const [zaps, setZaps] = useState(engagement?.zaps ?? 0);

  const handleZap = () => {
    setIsZapped(!isZapped);
    setZaps(prev => isZapped ? prev - 1 : prev + 1);
    onZap?.();
  };

  return (
    <Card className={cn(
      "w-full max-w-2xl mx-auto overflow-hidden",
      "border border-zinc-200 dark:border-zinc-800",
      "rounded-xl shadow-sm",
      className
    )}>
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background">
              <AvatarImage src={author?.avatar} alt={author?.name} />
              <AvatarFallback>{author?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {author?.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {author?.username && `@${author.username} · `}{author?.timeAgo}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMore}
            className="h-8 w-8 rounded-full"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <h2 className="text-base font-semibold mb-2">{workout.title}</h2>
        <p className="text-sm text-muted-foreground mb-4">{workout.content}</p>

        {/* Workout details */}
        <div className="flex flex-wrap gap-2 mb-4">
          {workout.date && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">{workout.date}</span>
            </Badge>
          )}
          {workout.location && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{workout.location}</span>
            </Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
            <Clock className="h-3 w-3" />
            <span className="text-xs">{workout.timestamp}</span>
          </Badge>
        </div>

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-3 mb-2">
            {metrics.map((metric, index) => (
              <div key={index} className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  {metric.icon}
                  <span className="text-xs font-medium">{metric.label}</span>
                </div>
                <div className="text-center">
                  <span className="text-base font-bold">{metric.value}</span>
                  <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between items-center border-t border-border">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZap}
                className={cn(
                  "flex items-center gap-2",
                  isZapped ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                )}
              >
                <Zap
                  className={cn(
                    "h-4 w-4 transition-all",
                    isZapped && "fill-amber-500"
                  )}
                />
                <span>{zaps}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zap this workout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <div className="text-xs text-muted-foreground">
          NIP-101e Kind 1301
        </div>
      </CardFooter>
    </Card>
  );
}

// Example usage
export default function WorkoutCardDemo() {
  const [workoutData, setWorkoutData] = useState({
    author: {
      name: "Alex Runner",
      username: "alexrunner",
      avatar: "https://i.pravatar.cc/150?u=alexrunner",
      timeAgo: "2h ago",
    },
    workout: {
      title: "Morning Trail Run",
      content: "Great morning run through the forest trails. Felt strong on the hills and enjoyed the sunrise. Perfect weather conditions today!",
      timestamp: "07:30 AM",
      location: "Forest Park",
      date: "Today"
    },
    metrics: [
      {
        label: "Distance",
        value: "8.2",
        unit: "km",
        icon: <TrendingUp className="h-3 w-3" />
      },
      {
        label: "Time",
        value: "42:15",
        unit: "min",
        icon: <Timer className="h-3 w-3" />
      },
      {
        label: "Pace",
        value: "5:09",
        unit: "min/km",
        icon: <Clock className="h-3 w-3" />
      }
    ],
    engagement: {
      zaps: 24,
      isZapped: false
    }
  });

  const handleZap = () => {
    console.log("Zapped workout");
  };

  const handleMore = () => {
    console.log("More options");
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <WorkoutCard
        author={workoutData.author}
        workout={workoutData.workout}
        metrics={workoutData.metrics}
        engagement={workoutData.engagement}
        onZap={handleZap}
        onMore={handleMore}
      />
    </div>
  );
} 