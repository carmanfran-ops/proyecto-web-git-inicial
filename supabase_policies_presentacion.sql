-- VILAHEXDOSS CRM - POLÍTICAS TEMPORALES PARA PRESENTACIÓN
-- Permite usar el CRM desde GitHub Pages con la clave pública.
-- Cuando añadamos login, cambiaremos estas políticas por seguridad por usuario.

alter table clientes enable row level security;
alter table incidencias enable row level security;
alter table seguimientos enable row level security;
alter table agenda enable row level security;

drop policy if exists "crm_select_clientes" on clientes;
drop policy if exists "crm_insert_clientes" on clientes;
drop policy if exists "crm_update_clientes" on clientes;
drop policy if exists "crm_delete_clientes" on clientes;
drop policy if exists "crm_select_incidencias" on incidencias;
drop policy if exists "crm_insert_incidencias" on incidencias;
drop policy if exists "crm_update_incidencias" on incidencias;
drop policy if exists "crm_delete_incidencias" on incidencias;
drop policy if exists "crm_select_seguimientos" on seguimientos;
drop policy if exists "crm_insert_seguimientos" on seguimientos;
drop policy if exists "crm_update_seguimientos" on seguimientos;
drop policy if exists "crm_delete_seguimientos" on seguimientos;
drop policy if exists "crm_select_agenda" on agenda;
drop policy if exists "crm_insert_agenda" on agenda;
drop policy if exists "crm_update_agenda" on agenda;
drop policy if exists "crm_delete_agenda" on agenda;

create policy "crm_select_clientes" on clientes for select using (true);
create policy "crm_insert_clientes" on clientes for insert with check (true);
create policy "crm_update_clientes" on clientes for update using (true) with check (true);
create policy "crm_delete_clientes" on clientes for delete using (true);
create policy "crm_select_incidencias" on incidencias for select using (true);
create policy "crm_insert_incidencias" on incidencias for insert with check (true);
create policy "crm_update_incidencias" on incidencias for update using (true) with check (true);
create policy "crm_delete_incidencias" on incidencias for delete using (true);
create policy "crm_select_seguimientos" on seguimientos for select using (true);
create policy "crm_insert_seguimientos" on seguimientos for insert with check (true);
create policy "crm_update_seguimientos" on seguimientos for update using (true) with check (true);
create policy "crm_delete_seguimientos" on seguimientos for delete using (true);
create policy "crm_select_agenda" on agenda for select using (true);
create policy "crm_insert_agenda" on agenda for insert with check (true);
create policy "crm_update_agenda" on agenda for update using (true) with check (true);
create policy "crm_delete_agenda" on agenda for delete using (true);
