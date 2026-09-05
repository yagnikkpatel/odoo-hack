export type ScheduleType = "full_time" | "part_time" | "flexible";
export type DayPeriod = "morning" | "afternoon" | "full_day";

export type WorkingScheduleRow = {
  id: string;
  name: string;
  schedule_type: ScheduleType;
  timezone: string;
  hours_per_week: string;
  is_flexible: boolean;
  active: boolean;
  employee_count: string;
  created_at: Date;
  updated_at: Date;
};

export type WorkingScheduleLineRow = {
  id: string;
  working_schedule_id: string;
  day_of_week: number;
  day_period: DayPeriod;
  start_time: string;
  end_time: string;
  break_minutes: number;
};

export type ScheduleLineInput = {
  day_of_week: number;
  day_period?: DayPeriod;
  start_time: string;
  end_time: string;
  break_minutes?: number;
};
