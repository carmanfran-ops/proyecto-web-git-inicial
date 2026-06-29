/* =========================================================
   VILAHEXDOSS CRM - SUPABASE SYNC
   Versión presentación: Supabase + copia local de seguridad
   ========================================================= */

const SUPABASE_URL = "https://xykhhnquponhkzmnjrds.supabase.co";
const SUPABASE_KEY = "sb_publishable_lYgf8AHiI8SVEk09cOPyYw_1dP0GEwb";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DB_TABLES = {
  centralita_clientes: "clientes",
  centralita_llamadas: "incidencias",
  centralita_seguimientos: "seguimientos",
  vilahexdoss_agenda: "agenda"
};

const FIELD_MAP = {
  clientes: {
    toDb: { id: "id", codigo: "codigo", nombre: "nombre", contacto: "contacto", telefono: "telefono", email: "email", direccion: "direccion" },
    fromDb: { id: "id", codigo: "codigo", nombre: "nombre", contacto: "contacto", telefono: "telefono", email: "email", direccion: "direccion" }
  },
  incidencias: {
    toDb: { id: "id", fecha: "fecha", hora: "hora", clienteId: "cliente_id", clienteManual: "cliente_manual", persona: "persona", telefono: "telefono", email: "email", tipo: "tipo", urgencia: "urgencia", avisarA: "avisar_a", estado: "estado", queSucede: "que_sucede", proximaAccion: "proxima_accion", fechaSeguimiento: "fecha_seguimiento", estadoPresupuesto: "estado_presupuesto", numeroPresupuesto: "numero_presupuesto", importePresupuesto: "importe_presupuesto", notas: "notas" },
    fromDb: { id: "id", fecha: "fecha", hora: "hora", cliente_id: "clienteId", cliente_manual: "clienteManual", persona: "persona", telefono: "telefono", email: "email", tipo: "tipo", urgencia: "urgencia", avisar_a: "avisarA", estado: "estado", que_sucede: "queSucede", proxima_accion: "proximaAccion", fecha_seguimiento: "fechaSeguimiento", estado_presupuesto: "estadoPresupuesto", numero_presupuesto: "numeroPresupuesto", importe_presupuesto: "importePresupuesto", notas: "notas" }
  },
  seguimientos: {
    toDb: { id: "id", llamadaId: "llamada_id", fecha: "fecha", tipo: "tipo", comentario: "comentario", usuario: "usuario" },
    fromDb: { id: "id", llamada_id: "llamadaId", fecha: "fecha", tipo: "tipo", comentario: "comentario", usuario: "usuario" }
  },
  agenda: {
    toDb: { id: "id", fecha: "fecha", hora: "hora", tipo: "tipo", cliente: "cliente", descripcion: "descripcion", estado: "estado", prioridad: "prioridad", llamadaId: "llamada_id" },
    fromDb: { id: "id", fecha: "fecha", hora: "hora", tipo: "tipo", cliente: "cliente", descripcion: "descripcion", estado: "estado", prioridad: "prioridad", llamada_id: "llamadaId" }
  }
};

function mapToDb(table, item) {
  const map = FIELD_MAP[table]?.toDb || {};
  const out = {};
  Object.keys(map).forEach(localKey => {
    const dbKey = map[localKey];
    if (item[localKey] !== undefined) out[dbKey] = item[localKey] === "" ? null : item[localKey];
  });
  return out;
}

function mapFromDb(table, row) {
  const map = FIELD_MAP[table]?.fromDb || {};
  const out = {};
  Object.keys(map).forEach(dbKey => {
    const localKey = map[dbKey];
    out[localKey] = row[dbKey] ?? "";
  });
  if (out.id !== undefined) out.id = Number(out.id);
  if (out.clienteId !== undefined && out.clienteId !== "") out.clienteId = Number(out.clienteId);
  if (out.llamadaId !== undefined && out.llamadaId !== "") out.llamadaId = Number(out.llamadaId);
  return out;
}

window.VilahexDB = {
  enabled: true,
  loading: false,

  async loadAll() {
    this.loading = true;
    try {
      await this.loadCollection("centralita_clientes");
      await this.loadCollection("centralita_llamadas");
      await this.loadCollection("centralita_seguimientos");
      await this.loadCollection("vilahexdoss_agenda");
      console.log("✅ Supabase cargado correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error cargando Supabase:", error);
      return false;
    } finally {
      this.loading = false;
    }
  },

  async loadCollection(localKey) {
    const table = DB_TABLES[localKey];
    if (!table) return;
    const { data, error } = await supabaseClient.from(table).select("*").order("id", { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(row => mapFromDb(table, row));
    localStorage.setItem(localKey, JSON.stringify(mapped));
  },

  async saveCollection(localKey, items) {
    if (!this.enabled || this.loading) return;
    const table = DB_TABLES[localKey];
    if (!table) return;
    try {
      const payload = (items || []).map(item => mapToDb(table, item));
      if (!payload.length) return;
      const { error } = await supabaseClient.from(table).upsert(payload, { onConflict: "id" });
      if (error) throw error;
      console.log(`✅ Sincronizado ${table}`, payload.length);
    } catch (error) {
      console.error(`❌ Error sincronizando ${table}:`, error);
      if (typeof showToast === "function") showToast("Guardado local. Error al sincronizar nube.");
    }
  },

  async deleteRow(localKey, id) {
    if (!this.enabled) return;
    const table = DB_TABLES[localKey];
    if (!table) return;
    try {
      const { error } = await supabaseClient.from(table).delete().eq("id", id);
      if (error) throw error;
      console.log(`✅ Eliminado ${table} #${id}`);
    } catch (error) {
      console.error(`❌ Error eliminando ${table}:`, error);
    }
  }
};
