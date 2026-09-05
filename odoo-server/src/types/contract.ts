export type ContractStatus = "draft" | "running" | "expired" | "cancelled";
export type WageType = "monthly" | "hourly" | "daily";

export type ContractRow = {
  id: string;
  reference: string;
  employee_id: string;
  employee_number: string;
  employee_full_name: string;
  employee_photo_url: string | null;
  start_date: string;
  end_date: string | null;
  status: ContractStatus;
  is_active_now: boolean;
  employment_type_id: string;
  employment_type_name: string;
  employment_type_code: string;
  department_id: string | null;
  department_name: string | null;
  job_position_id: string | null;
  job_position_name: string | null;
  working_schedule_id: string;
  working_schedule_name: string;
  working_schedule_hours: string;
  salary_structure_id: string;
  salary_structure_name: string;
  wage: string;
  wage_type: WageType;
  currency_code: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ContractWriteData = {
  employee_id?: string;
  start_date?: string;
  end_date?: string | null;
  employment_type_id?: string;
  department_id?: string | null;
  job_position_id?: string | null;
  working_schedule_id?: string;
  salary_structure_id?: string;
  wage?: string;
  wage_type?: WageType;
  notes?: string | null;
};
