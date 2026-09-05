-- Additive recovery: works both on databases with the former 012 migration
-- and fresh databases. No existing attendance/profile data is removed.
ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS work_latitude double precision,
  ADD COLUMN IF NOT EXISTS work_longitude double precision,
  ADD COLUMN IF NOT EXISTS work_radius_m integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS face_descriptor real[],
  ADD COLUMN IF NOT EXISTS face_source text,
  ADD COLUMN IF NOT EXISTS face_image_url text,
  ADD COLUMN IF NOT EXISTS face_image_public_id text,
  ADD COLUMN IF NOT EXISTS face_enrolled_at timestamptz;

ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS check_in_verification jsonb,
  ADD COLUMN IF NOT EXISTS check_out_verification jsonb;

-- NOT VALID avoids scanning/blocking a populated table during deployment;
-- PostgreSQL still enforces these checks on all new inserts and updates.
-- Historical rows can be audited before separately validating constraints.
ALTER TABLE employee_profiles
  ADD CONSTRAINT employee_profiles_verification_coordinates_v2 CHECK (
    (work_latitude IS NULL AND work_longitude IS NULL) OR
    (work_latitude IS NOT NULL AND work_longitude IS NOT NULL AND
     work_latitude BETWEEN -90 AND 90 AND work_longitude BETWEEN -180 AND 180)
  ) NOT VALID,
  ADD CONSTRAINT employee_profiles_verification_radius_v2 CHECK (
    work_radius_m IS NOT NULL AND work_radius_m BETWEEN 10 AND 5000
  ) NOT VALID,
  ADD CONSTRAINT employee_profiles_verification_source_v2 CHECK (
    face_source IS NULL OR face_source IN ('self', 'hr_photo')
  ) NOT VALID,
  ADD CONSTRAINT employee_profiles_verification_descriptor_v2 CHECK (
    face_descriptor IS NULL OR (
      array_ndims(face_descriptor) = 1 AND cardinality(face_descriptor) = 128 AND
      array_position(face_descriptor, NULL) IS NULL AND
      array_position(face_descriptor, 'NaN'::real) IS NULL AND
      array_position(face_descriptor, 'Infinity'::real) IS NULL AND
      array_position(face_descriptor, '-Infinity'::real) IS NULL
    )
  ) NOT VALID;
