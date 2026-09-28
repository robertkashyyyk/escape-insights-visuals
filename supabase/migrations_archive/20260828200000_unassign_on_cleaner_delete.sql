-- Guardrail: when a cleaner is deleted, any live clean still assigned to them must
-- become properly UNASSIGNED (not left as status 'scheduled' with a null cleaner,
-- which hides it from the re-assignment pool). Runs for every delete path.
create or replace function public.tg_cleaner_delete_unassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clean_tasks
     set assigned_cleaner_id = null,
         status = 'unassigned'
   where assigned_cleaner_id = old.id
     and status not in ('cancelled','canceled','completed','done');
  return old;
end;
$$;

drop trigger if exists trg_cleaner_delete_unassign on public.cleaners;
create trigger trg_cleaner_delete_unassign
  before delete on public.cleaners
  for each row execute function public.tg_cleaner_delete_unassign();
