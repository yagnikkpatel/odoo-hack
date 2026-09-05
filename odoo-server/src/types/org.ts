export type DepartmentRow = {
  id: string;
  name: string;
  parent_id: string | null;
  manager_id: string | null;
  manager_employee_number: string | null;
  manager_full_name: string | null;
  manager_photo_url: string | null;
  employee_count: string;
  active: boolean;
};

export type JobPositionRow = {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
  employee_count: string;
  active: boolean;
};

export type EmploymentTypeRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};
