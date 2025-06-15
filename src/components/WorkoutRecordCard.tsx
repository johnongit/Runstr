import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Clock, MapPin, Calendar, TrendingUp, Timer, Users, Trophy } from "lucide-react";

interface WorkoutMetric {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}

interface TeamInfo {
  aTag: string;
  captain: string;
  uuid: string;
  relayHint: string;
  teamName: string;
  identifier: string;
}

interface ChallengeInfo {
  uuid: string;
  name: string;
  challengeValue: string;
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
    teams?: TeamInfo[];
    challenges?: ChallengeInfo[];
  };
  metrics?: WorkoutMetric[];
  engagement?: {
    zaps: number;
    isZapped?: boolean;
  };
  onZap?: () => void;
  onComment?: () => void;
  onShare?: () => void;
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
  className
}: WorkoutCardProps) {
  const [isZapped, setIsZapped] = useState(engagement?.isZapped ?? false);
  const [zaps, setZaps] = useState(engagement?.zaps ?? 0);

  const handleZap = () => {
    setIsZapped(!isZapped);
    setZaps(prev => isZapped ? prev - 1 : prev + 1);
    onZap?.();
  };

  const hasTeamsOrChallenges = (workout.teams && workout.teams.length > 0) || (workout.challenges && workout.challenges.length > 0);

  return (
    <Card className={cn(
      "w-full max-w-2xl mx-auto overflow-hidden",
      "bg-gradient-to-br from-slate-800 to-slate-900",
      "border border-purple-500/20",
      "rounded-xl shadow-lg",
      className
    )}>
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-purple-500/30">
              <AvatarImage src={author?.avatar} alt={author?.name} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">{author?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-sm font-medium text-white">
                {author?.name}
              </h3>
              <p className="text-xs text-slate-400">
                {author?.username && `@${author.username} · `}{author?.timeAgo}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <h2 className="text-base font-semibold mb-2 text-white">{workout.title}</h2>
        <p className="text-sm text-slate-300 mb-4">{workout.content}</p>

        {/* Team and Challenge Badges */}
        {hasTeamsOrChallenges && (
          <div className="flex flex-wrap gap-2 mb-4">
            {workout.teams?.map((team, index) => (
              <Badge 
                key={`team-${index}`}
                variant="outline" 
                className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 text-green-300"
              >
                <Users className="h-3 w-3" />
                <span className="text-xs font-medium">
                  {team.teamName || `Team ${team.uuid.slice(0, 8)}`}
                </span>
              </Badge>
            ))}
            {workout.challenges?.map((challenge, index) => (
              <Badge 
                key={`challenge-${index}`}
                variant="outline" 
                className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/30 text-orange-300"
              >
                <Trophy className="h-3 w-3" />
                <span className="text-xs font-medium">
                  {challenge.name}
                </span>
              </Badge>
            ))}
          </div>
        )}

        {/* Workout details */}
        <div className="flex flex-wrap gap-2 mb-4">
          {workout.date && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 border-purple-500/30 bg-purple-500/10 text-purple-300">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">{workout.date}</span>
            </Badge>
          )}
          {workout.location && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 border-purple-500/30 bg-purple-500/10 text-purple-300">
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
          <div className="grid grid-cols-3 gap-2 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg p-3 mb-2 border border-purple-500/20">
            {metrics.map((metric, index) => (
              <div key={index} className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-purple-400 mb-1">
                  {metric.icon}
                  <span className="text-xs font-medium">{metric.label}</span>
                </div>
                <div className="text-center">
                  <span className="text-base font-bold text-white">{metric.value}</span>
                  <span className="text-xs text-slate-400 ml-1">{metric.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between items-center border-t border-purple-500/20">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZap}
                className={cn(
                  "flex items-center gap-2 hover:bg-purple-500/10",
                  isZapped ? "text-amber-400" : "text-slate-400 hover:text-amber-400"
                )}
              >
                <Zap
                  className={cn(
                    "h-4 w-4 transition-all",
                    isZapped && "fill-amber-400"
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
        
        <div className="text-xs text-purple-400">
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <WorkoutCard
        author={workoutData.author}
        workout={workoutData.workout}
        metrics={workoutData.metrics}
        engagement={workoutData.engagement}
        onZap={handleZap}
      />
    </div>
  );
} 