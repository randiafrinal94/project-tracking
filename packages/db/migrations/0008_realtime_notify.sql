-- ===========================================================================
-- Realtime: event ringkas (hanya ID) ke channel `pt_events` untuk di-fan-out API
-- via Server-Sent Events. Client me-refetch data terkait (payload < 8 KB).
-- ===========================================================================
CREATE OR REPLACE FUNCTION notify_activity_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('pt_events', json_build_object(
    'type', 'activity',
    'workspaceId', NEW.workspace_id,
    'projectId', NEW.project_id,
    'taskId', NEW.task_id,
    'actorId', NEW.actor_id,
    'action', NEW.action
  )::text);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_activity_logs_notify
  AFTER INSERT ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION notify_activity_event();
--> statement-breakpoint

-- Reorder di dalam kolom tidak masuk activity log, tapi board user lain tetap perlu sinkron.
CREATE OR REPLACE FUNCTION notify_task_reorder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.sort_order IS NOT DISTINCT FROM OLD.sort_order THEN
    RETURN NULL;
  END IF;
  SELECT workspace_id INTO v_workspace_id FROM projects WHERE id = NEW.project_id;
  PERFORM pg_notify('pt_events', json_build_object(
    'type', 'activity',
    'workspaceId', v_workspace_id,
    'projectId', NEW.project_id,
    'taskId', NEW.id,
    'actorId', activity_actor(),
    'action', 'task.reordered'
  )::text);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_tasks_reorder_notify
  AFTER UPDATE OF sort_order ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_reorder();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION notify_notification_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('pt_events', json_build_object(
    'type', 'notification',
    'userId', NEW.user_id,
    'workspaceId', NEW.workspace_id
  )::text);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_notifications_notify
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_notification_event();
