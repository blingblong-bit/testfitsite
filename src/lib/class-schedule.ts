export type ClassEntry = {
  name: string;
  time: string;
  instructor?: string;
};

export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export const CLASS_SCHEDULE: Record<DayOfWeek, ClassEntry[]> = {
  Sunday: [],
  Monday: [
    { name: "FIT HIIT", time: "8:00 AM", instructor: "Emily" },
    { name: "TRX Circuit", time: "12:00 PM", instructor: "Emily" },
    { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
    { name: "Kickboxing / Lift", time: "6:15 PM", instructor: "Carla" },
  ],
  Tuesday: [
    { name: "Cardio Barre", time: "5:00 AM" },
    { name: "Yoga", time: "8:00 AM", instructor: "Hope" },
  ],
  Wednesday: [
    { name: "FIT HIIT / TRX", time: "8:00 AM", instructor: "Emily" },
    { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
    { name: "Cardio / Lift", time: "6:15 PM", instructor: "Carla" },
  ],
  Thursday: [
    { name: "Cardio Barre", time: "5:00 AM" },
    { name: "Yoga", time: "8:00 AM", instructor: "Hope" },
    { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
  ],
  Friday: [
    { name: "TRX Circuit", time: "12:00 PM", instructor: "Emily" },
    { name: "HIIT", time: "5:30 PM", instructor: "Carla" },
  ],
  Saturday: [
    { name: "Pilates Stretch", time: "8:00 AM", instructor: "Carla" },
  ],
};

export const DAYS: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getDayName(date: Date = new Date()): DayOfWeek {
  return DAYS[date.getDay()];
}

export function getClassesForDay(day: DayOfWeek): ClassEntry[] {
  return CLASS_SCHEDULE[day] ?? [];
}
