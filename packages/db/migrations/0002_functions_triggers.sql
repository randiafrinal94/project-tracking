-- ---------------------------------------------------------------------------
-- set_updated_at(): mengisi kolom updated_at = CURRENT_TIMESTAMP sebelum UPDATE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'workspaces',
    'workspace_members',
    'projects',
    'milestones',
    'tasks',
    'tags',
    'subtasks',
    'comments'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t
    );
  END LOOP;
END;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- assign_task_number(): menomori task per project ({PREFIX}-{task_number}).
-- UPDATE ... RETURNING mengunci baris project, sehingga INSERT paralel pada
-- project yang sama terserialisasi dan tidak pernah mendapat nomor ganda.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_task_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    UPDATE projects
       SET task_counter = task_counter + 1
     WHERE id = NEW.project_id
    RETURNING task_counter INTO NEW.task_number;

    IF NEW.task_number IS NULL THEN
      RAISE EXCEPTION 'Project % tidak ditemukan', NEW.project_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSE
    -- Nomor eksplisit (mis. import data): pastikan counter tidak tertinggal.
    UPDATE projects
       SET task_counter = GREATEST(task_counter, NEW.task_number)
     WHERE id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_tasks_assign_number
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION assign_task_number();
--> statement-breakpoint

-- Nomor task dan project induk bersifat permanen setelah dibuat.
CREATE OR REPLACE FUNCTION prevent_task_identity_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.task_number IS DISTINCT FROM OLD.task_number
     OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'task_number dan project_id tidak boleh diubah (task %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_tasks_identity_immutable
  BEFORE UPDATE OF task_number, project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION prevent_task_identity_change();
