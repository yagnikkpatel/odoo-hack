import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
type Entry = { at: Date; kind: "Check-in" | "Check-out" };
const Context = createContext<{
  checkedIn: boolean;
  entries: Entry[];
  record: () => void;
} | null>(null);
// Session-only demo state; replace with authenticated attendance APIs.
export function AttendanceProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const checkedIn = entries[0]?.kind === "Check-in";
  function record() {
    setEntries((previous) => [
      {
        at: new Date(),
        kind: previous[0]?.kind === "Check-in" ? "Check-out" : "Check-in",
      },
      ...previous,
    ]);
  }
  return (
    <Context.Provider value={{ entries, checkedIn, record }}>
      {children}
    </Context.Provider>
  );
}
export function useAttendance() {
  const value = useContext(Context);
  if (!value) throw new Error("AttendanceProvider is required");
  return value;
}
export function timeLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
export const sampleDays = [
  {
    day: "Fri, 28 Aug",
    start: "09:02",
    end: "18:10",
    hours: "8h 08m",
    status: "Late",
  },
  {
    day: "Thu, 27 Aug",
    start: "08:56",
    end: "18:02",
    hours: "8h 06m",
    status: "On time",
  },
  {
    day: "Wed, 26 Aug",
    start: "08:58",
    end: "18:14",
    hours: "8h 16m",
    status: "On time",
  },
  {
    day: "Tue, 25 Aug",
    start: "08:52",
    end: "18:05",
    hours: "8h 13m",
    status: "On time",
  },
  {
    day: "Mon, 24 Aug",
    start: "08:59",
    end: "18:00",
    hours: "8h 01m",
    status: "On time",
  },
];
