-- ===========================================================================
-- Sinkronisasi completed_at
-- ===========================================================================
CREATE OR REPLACE FUNCTION sync_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.completed_at := coalesce(NEW.completed_at, CURRENT_TIMESTAMP);
    ELSIF OLD.status IS DISTINCT FROM 'done' THEN
      NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_tasks_completed_at
  BEFORE INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION sync_task_completed_at();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_subtask_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_completed THEN
    IF TG_OP = 'INSERT' THEN
      NEW.completed_at := coalesce(NEW.completed_at, CURRENT_TIMESTAMP);
    ELSIF NOT OLD.is_completed THEN
      NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_subtasks_completed_at
  BEFORE INSERT OR UPDATE OF is_completed ON subtasks
  FOR EACH ROW EXECUTE FUNCTION sync_subtask_completed_at();
--> statement-breakpoint

-- ===========================================================================
-- Activity log
--   Aktor  : SELECT set_config('app.actor_id', '<uuid>', true)  (per transaksi)
--   Bypass : SELECT set_config('app.skip_activity', 'on', true) (seeder/import)
-- ===========================================================================
CREATE OR REPLACE FUNCTION activity_actor()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION activity_disabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.skip_activity', true), '') = 'on'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION log_activity(
  p_workspace_id uuid,
  p_project_id uuid,
  p_task_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO activity_logs
    (workspace_id, project_id, task_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES
    (p_workspace_id, p_project_id, p_task_id, activity_actor(), p_action, p_entity_type,
     p_entity_id, coalesce(p_metadata, '{}'::jsonb))
$$;
--> statement-breakpoint

-- --- projects --------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_fields text[] := '{}';
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(NEW.workspace_id, NEW.id, NULL, 'project.created', 'project', NEW.id,
      jsonb_build_object('name', NEW.name, 'keyPrefix', NEW.key_prefix));
    RETURN NULL;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM log_activity(NEW.workspace_id, NEW.id, NULL, 'project.deleted', 'project', NEW.id,
      jsonb_build_object('name', NEW.name));
    RETURN NULL;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    PERFORM log_activity(NEW.workspace_id, NEW.id, NULL, 'project.restored', 'project', NEW.id,
      jsonb_build_object('name', NEW.name));
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM log_activity(NEW.workspace_id, NEW.id, NULL, 'project.status_changed', 'project', NEW.id,
      jsonb_build_object('name', NEW.name, 'from', OLD.status, 'to', NEW.status));
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := array_append(v_fields, 'description'); END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN v_fields := array_append(v_fields, 'startDate'); END IF;
  IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN v_fields := array_append(v_fields, 'targetDate'); END IF;

  IF cardinality(v_fields) > 0 THEN
    PERFORM log_activity(NEW.workspace_id, NEW.id, NULL, 'project.updated', 'project', NEW.id,
      jsonb_build_object('name', NEW.name, 'fields', to_jsonb(v_fields)));
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_projects_activity
  AFTER INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_project_activity();
--> statement-breakpoint

-- --- milestones ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_milestone_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_row milestones%ROWTYPE;
  v_workspace_id uuid;
  v_action text;
  v_fields text[] := '{}';
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;
  -- DELETE hasil cascade (project/workspace dihapus) tidak dicatat.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT workspace_id INTO v_workspace_id FROM projects WHERE id = v_row.project_id;
  IF v_workspace_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'milestone.created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'milestone.deleted';
  ELSE
    IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
      PERFORM log_activity(v_workspace_id, NEW.project_id, NULL, 'milestone.completed', 'milestone',
        NEW.id, jsonb_build_object('name', NEW.name));
    ELSIF OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL THEN
      PERFORM log_activity(v_workspace_id, NEW.project_id, NULL, 'milestone.reopened', 'milestone',
        NEW.id, jsonb_build_object('name', NEW.name));
    END IF;

    IF NEW.name IS DISTINCT FROM OLD.name THEN v_fields := array_append(v_fields, 'name'); END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := array_append(v_fields, 'description'); END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN v_fields := array_append(v_fields, 'startDate'); END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN v_fields := array_append(v_fields, 'dueDate'); END IF;
    IF cardinality(v_fields) = 0 THEN RETURN NULL; END IF;
    v_action := 'milestone.updated';
  END IF;

  PERFORM log_activity(v_workspace_id, v_row.project_id, NULL, v_action, 'milestone', v_row.id,
    CASE WHEN cardinality(v_fields) > 0
      THEN jsonb_build_object('name', v_row.name, 'fields', to_jsonb(v_fields))
      ELSE jsonb_build_object('name', v_row.name)
    END);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_milestones_activity
  AFTER INSERT OR UPDATE OR DELETE ON milestones
  FOR EACH ROW EXECUTE FUNCTION log_milestone_activity();
--> statement-breakpoint

-- --- tasks -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id uuid;
  v_key text;
  v_fields text[] := '{}';
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;

  SELECT workspace_id, key_prefix || '-' || NEW.task_number
    INTO v_workspace_id, v_key
    FROM projects WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.created', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title, 'status', NEW.status));
    RETURN NULL;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.deleted', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title));
    RETURN NULL;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.restored', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title));
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.moved', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title, 'from', OLD.status, 'to', NEW.status));
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.assigned', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title,
        'from', OLD.assignee_id, 'to', NEW.assignee_id));
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.priority_changed', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title, 'from', OLD.priority, 'to', NEW.priority));
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN v_fields := array_append(v_fields, 'title'); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := array_append(v_fields, 'description'); END IF;
  IF NEW.milestone_id IS DISTINCT FROM OLD.milestone_id THEN v_fields := array_append(v_fields, 'milestoneId'); END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN v_fields := array_append(v_fields, 'startDate'); END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN v_fields := array_append(v_fields, 'dueDate'); END IF;
  IF NEW.estimate_hours IS DISTINCT FROM OLD.estimate_hours THEN v_fields := array_append(v_fields, 'estimateHours'); END IF;
  IF NEW.actual_hours IS DISTINCT FROM OLD.actual_hours THEN v_fields := array_append(v_fields, 'actualHours'); END IF;

  IF cardinality(v_fields) > 0 THEN
    PERFORM log_activity(v_workspace_id, NEW.project_id, NEW.id, 'task.updated', 'task', NEW.id,
      jsonb_build_object('key', v_key, 'title', NEW.title, 'fields', to_jsonb(v_fields)));
  END IF;
  -- Perubahan sort_order saja (reorder dalam kolom) sengaja tidak dicatat.
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_tasks_activity
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_activity();
--> statement-breakpoint

-- --- helper: konteks task untuk entitas anak --------------------------------
CREATE OR REPLACE FUNCTION task_activity_context(
  p_task_id uuid,
  OUT workspace_id uuid,
  OUT project_id uuid,
  OUT task_key text
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.workspace_id, p.id, p.key_prefix || '-' || t.task_number
    FROM tasks t JOIN projects p ON p.id = t.project_id
   WHERE t.id = p_task_id
$$;
--> statement-breakpoint

-- --- subtasks --------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_subtask_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_row subtasks%ROWTYPE;
  v_ctx record;
  v_action text;
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'subtask.created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'subtask.deleted';
  ELSIF NEW.is_completed IS DISTINCT FROM OLD.is_completed THEN
    v_action := CASE WHEN NEW.is_completed THEN 'subtask.completed' ELSE 'subtask.reopened' END;
  ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
    v_action := 'subtask.updated';
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO v_ctx FROM task_activity_context(v_row.task_id);
  IF v_ctx.workspace_id IS NULL THEN RETURN NULL; END IF;

  PERFORM log_activity(v_ctx.workspace_id, v_ctx.project_id, v_row.task_id, v_action, 'subtask',
    v_row.id, jsonb_build_object('key', v_ctx.task_key, 'title', v_row.title));
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_subtasks_activity
  AFTER INSERT OR UPDATE OR DELETE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION log_subtask_activity();
--> statement-breakpoint

-- --- comments (soft delete; hard delete hanya via cascade) ------------------
CREATE OR REPLACE FUNCTION log_comment_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ctx record;
  v_action text;
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'comment.created';
  ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    v_action := 'comment.deleted';
  ELSIF NEW.body IS DISTINCT FROM OLD.body THEN
    v_action := 'comment.edited';
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO v_ctx FROM task_activity_context(NEW.task_id);
  IF v_ctx.workspace_id IS NULL THEN RETURN NULL; END IF;

  PERFORM log_activity(v_ctx.workspace_id, v_ctx.project_id, NEW.task_id, v_action, 'comment',
    NEW.id, jsonb_build_object('key', v_ctx.task_key, 'excerpt', left(NEW.body, 140)));
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_comments_activity
  AFTER INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION log_comment_activity();
--> statement-breakpoint

-- --- task_tags -------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_task_tag_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_row task_tags%ROWTYPE;
  v_ctx record;
  v_tag record;
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT * INTO v_ctx FROM task_activity_context(v_row.task_id);
  SELECT name, color INTO v_tag FROM tags WHERE id = v_row.tag_id;
  IF v_ctx.workspace_id IS NULL OR v_tag IS NULL THEN RETURN NULL; END IF;

  PERFORM log_activity(v_ctx.workspace_id, v_ctx.project_id, v_row.task_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'task.tag_added' ELSE 'task.tag_removed' END,
    'task', v_row.task_id,
    jsonb_build_object('key', v_ctx.task_key, 'tag', v_tag.name, 'color', v_tag.color));
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_task_tags_activity
  AFTER INSERT OR DELETE ON task_tags
  FOR EACH ROW EXECUTE FUNCTION log_task_tag_activity();
