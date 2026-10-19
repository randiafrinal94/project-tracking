-- Activity log untuk lampiran: attachment.added / attachment.removed.
-- DELETE hasil cascade (task/project/workspace dihapus) tidak dicatat.
CREATE OR REPLACE FUNCTION log_attachment_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_row attachments%ROWTYPE;
  v_ctx record;
BEGIN
  IF activity_disabled() THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT * INTO v_ctx FROM task_activity_context(v_row.task_id);
  IF v_ctx.workspace_id IS NULL THEN RETURN NULL; END IF;

  PERFORM log_activity(v_ctx.workspace_id, v_ctx.project_id, v_row.task_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'attachment.added' ELSE 'attachment.removed' END,
    'attachment', v_row.id,
    jsonb_build_object('key', v_ctx.task_key, 'fileName', v_row.file_name, 'sizeBytes', v_row.size_bytes));
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER trg_attachments_activity
  AFTER INSERT OR DELETE ON attachments
  FOR EACH ROW EXECUTE FUNCTION log_attachment_activity();
