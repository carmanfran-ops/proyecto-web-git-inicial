const STORAGE_KEYS = {
  clientes: "centralita_clientes",
  llamadas: "centralita_llamadas",
  seguimientos: "centralita_seguimientos"
};

const AGENDA_KEY = "vilahexdoss_agenda";

const PAGE_TEXT = {
  dashboard: ["Panel de Control", "Lo pendiente de hoy de un vistazo"],
  "nueva-llamada": ["Nueva Incidencia", "Registro rápido de incidencia y próxima acción"],
  llamadas: ["Incidencias", "Buscar, revisar y actualizar incidencias"],
  seguimiento: ["Seguimiento", "Pendientes de hoy e historial completo"],
  presupuestos: ["Presupuestos", "Estado de presupuestos vinculados a incidencias"],
  agenda: ["Mi Agenda", "Calendario mensual de visitas, llamadas, reuniones y tareas"],
  clientes: ["Clientes / Importar", "Actualizar clientes desde CSV exportado del otro programa"]
};

let filtroLlamadas = "abiertas";
let agendaMesActual = new Date();

function safeParse(json, fallback) {
  try { return JSON.parse(json) ?? fallback; } catch { return fallback; }
}
function getData(key) { return safeParse(localStorage.getItem(key), []); }
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getAgenda() { return safeParse(localStorage.getItem(AGENDA_KEY), []); }
function saveAgenda(agenda) { localStorage.setItem(AGENDA_KEY, JSON.stringify(agenda)); }
function getNextId(collection) { return collection.length ? Math.max(...collection.map(item => Number(item.id) || 0)) + 1 : 1; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isClosed(estado) { return ["Resuelto", "Cerrado", "Aceptado", "Rechazado"].includes(estado); }
function val(id) { return (document.getElementById(id)?.value || "").trim(); }

document.addEventListener("DOMContentLoaded", () => {
  const today = document.getElementById("today");
  if (today) {
    today.textContent = new Date().toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }

  setDefaultCallDateTime();

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtroLlamadas = btn.dataset.filter;
      renderLlamadas();
    });
  });

  ["buscarLlamadas", "buscarSeguimiento", "buscarPresupuestos", "buscarClientes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", renderAll);
  });

  const btnExportar = document.getElementById("btnExportar");
  if (btnExportar) btnExportar.addEventListener("click", exportAllData);

  const btnImportarBackup = document.getElementById("btnImportarBackup");
  const backupInput = document.getElementById("backupInput");
  if (btnImportarBackup && backupInput) {
    btnImportarBackup.addEventListener("click", () => backupInput.click());
    backupInput.addEventListener("change", importarBackupJSON);
  }

  const formLlamada = document.getElementById("formLlamada");
  if (formLlamada) formLlamada.addEventListener("submit", guardarLlamada);

  const clienteBusqueda = document.getElementById("clienteBusqueda");
  if (clienteBusqueda) clienteBusqueda.addEventListener("input", seleccionarClienteBuscado);

  renderAll();
});

function showSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  section.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === sectionId);
  });

  const text = PAGE_TEXT[sectionId] || ["VILAHEXDOSS CRM", ""];
  document.getElementById("pageTitle").textContent = text[0];
  document.getElementById("pageSubtitle").textContent = text[1];

  renderAll();
}

function renderAll() {
  renderClientes();
  renderClientesDatalist();
  renderDashboard();
  renderLlamadas();
  renderSeguimiento();
  renderPresupuestos();
  renderAgenda();
}

function setDefaultCallDateTime() {
  const now = new Date();
  const fecha = document.getElementById("llFecha");
  const hora = document.getElementById("llHora");
  if (fecha) fecha.value = now.toISOString().slice(0, 10);
  if (hora) hora.value = now.toTimeString().slice(0, 5);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function slug(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-").replaceAll("/", "-");
}

function limitText(text, max) {
  text = String(text || "");
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function formatMoney(value) {
  const n = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "0,00 €";
}

function formatFechaES(fecha) {
  if (!fecha) return "-";
  const partes = String(fecha).split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return fecha;
}

function formatFechaLarga(fecha) {
  if (!fecha) return "-";
  const [y, m, d] = String(fecha).split("-").map(Number);
  const date = y ? new Date(y, m - 1, d) : new Date(fecha);
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function renderDashboard() {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const hoy = todayISO();

  setText("countHoy", llamadas.filter(l => l.fecha === hoy).length);
  setText("countAvisar", llamadas.filter(l => l.estado === "Pendiente avisar").length);
  setText("countSegHoy", llamadas.filter(l => !isClosed(l.estado) && l.fechaSeguimiento && l.fechaSeguimiento <= hoy).length);
  setText("countPrePend", llamadas.filter(l => ["Pendiente", "Preparando"].includes(l.estadoPresupuesto)).length);

  const tareas = llamadas
    .filter(l => !isClosed(l.estado))
    .filter(l => l.fechaSeguimiento || l.proximaAccion || l.estado === "Pendiente avisar")
    .sort((a, b) => String(a.fechaSeguimiento || "9999-99-99").localeCompare(String(b.fechaSeguimiento || "9999-99-99")))
    .slice(0, 10);

  const lista = document.getElementById("listaHoy");
  if (lista) {
    lista.innerHTML = tareas.map(l => {
      const css = l.fechaSeguimiento && l.fechaSeguimiento < hoy ? "overdue" : (l.fechaSeguimiento === hoy ? "today" : "");
      return `<div class="task-item ${css}">
        <strong>${formatFechaES(l.fechaSeguimiento) || "Sin fecha"} · ${getNombreClienteLlamada(l)}</strong>
        <p>${l.proximaAccion || (l.estado === "Pendiente avisar" ? "Avisar a " + (l.avisarA || "pendiente") : "Revisar incidencia")}</p>
        <small>#${l.id} · ${l.estado} · ${l.tipo}</small>
      </div>`;
    }).join("") || "<p>No hay tareas pendientes.</p>";
  }

  const dash = document.getElementById("dashboardLlamadas");
  if (dash) {
    dash.innerHTML = llamadas.slice(-8).reverse().map(l => `
      <tr>
        <td>#${l.id}</td>
        <td>${l.hora || ""}</td>
        <td>${getNombreClienteLlamada(l)}</td>
        <td>${limitText(l.queSucede, 55)}</td>
        <td><span class="badge ${slug(l.estado)}">${l.estado}</span></td>
      </tr>
    `).join("") || "<tr><td colspan='5'>Sin incidencias.</td></tr>";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function guardarLlamada(event) {
  event.preventDefault();

  const llamadas = getData(STORAGE_KEYS.llamadas);
  const llamada = {
    id: getNextId(llamadas),
    fecha: val("llFecha"),
    hora: val("llHora"),
    clienteId: Number(val("llClienteId")) || null,
    clienteManual: val("llClienteManual"),
    persona: val("llPersona"),
    telefono: val("llTelefono"),
    email: val("llEmail"),
    tipo: val("llTipo"),
    urgencia: val("llUrgencia"),
    avisarA: val("llAvisarA"),
    estado: val("llEstado"),
    queSucede: val("llQueSucede"),
    proximaAccion: val("llProximaAccion"),
    fechaSeguimiento: val("llFechaSeguimiento"),
    estadoPresupuesto: val("llEstadoPresupuesto"),
    numeroPresupuesto: val("llNumeroPresupuesto"),
    importePresupuesto: "",
    notas: val("llNotas")
  };

  if (!llamada.clienteId && !llamada.clienteManual) return showToast("Selecciona o escribe un cliente");
  if (!llamada.queSucede) return showToast("Describe qué sucede");

  llamadas.push(llamada);
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(llamada.id, "Incidencia recibida", llamada.queSucede);

  event.target.reset();
  document.getElementById("llClienteId").value = "";
  document.getElementById("clienteEncontrado").innerHTML = "Busca un cliente. Si no existe, escribe el nombre manualmente.";
  setDefaultCallDateTime();
  renderAll();
  showToast("Incidencia guardada");
  showSection("llamadas");
}

function crmFechaES(fecha) { return formatFechaES(fecha); }

function crmDiasHasta(fecha) {
  if (!fecha) return null;
  const hoy = new Date(todayISO());
  const objetivo = new Date(fecha);
  return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function crmSemaforoSeguimiento(llamada) {
  if (isClosed(llamada.estado)) return `<span class="crm-pill crm-ok">✅ Cerrado</span>`;
  if (!llamada.fechaSeguimiento) return `<span class="crm-pill crm-muted">⚪ Sin fecha</span>`;
  const dias = crmDiasHasta(llamada.fechaSeguimiento);
  if (dias < 0) return `<span class="crm-pill crm-danger">🔴 Atrasado ${Math.abs(dias)} d.</span>`;
  if (dias === 0) return `<span class="crm-pill crm-warning">🟠 Hoy</span>`;
  if (dias <= 2) return `<span class="crm-pill crm-info">🟡 Próximo</span>`;
  return `<span class="crm-pill crm-ok">🟢 Futuro</span>`;
}

function crmPrioridad(urgencia) {
  const u = String(urgencia || "").toLowerCase();
  if (u.includes("urgent")) return `<span class="crm-pill crm-danger">🔴 Urgente</span>`;
  if (u.includes("alta")) return `<span class="crm-pill crm-high">🟠 Alta</span>`;
  if (u.includes("baja")) return `<span class="crm-pill crm-ok">🟢 Baja</span>`;
  return `<span class="crm-pill crm-warning">🟡 Normal</span>`;
}

function renderLlamadas() {
  const filtro = (document.getElementById("buscarLlamadas")?.value || "").toLowerCase();
  let llamadas = getData(STORAGE_KEYS.llamadas);

  llamadas = llamadas.filter(l => `${getNombreClienteLlamada(l)} ${l.persona} ${l.telefono} ${l.queSucede} ${l.estado} ${l.avisarA}`.toLowerCase().includes(filtro));

  if (filtroLlamadas === "abiertas") llamadas = llamadas.filter(l => !isClosed(l.estado));
  if (filtroLlamadas === "urgentes") llamadas = llamadas.filter(l => l.urgencia === "Urgente" || l.urgencia === "Alta");
  if (filtroLlamadas === "presupuestos") llamadas = llamadas.filter(l => l.estadoPresupuesto && l.estadoPresupuesto !== "No aplica");

  renderResumenIncidencias(llamadas);

  const tbody = document.getElementById("tablaLlamadas");
  if (!tbody) return;

  tbody.innerHTML = llamadas.slice().reverse().map(l => {
    const cliente = getCliente(l.clienteId);
    const clienteNombre = getNombreClienteLlamada(l);
    const clienteClick = l.clienteId
      ? `<button class="crm-client-link" onclick="verFichaCliente(${l.clienteId})">${clienteNombre}</button>`
      : `<strong>${clienteNombre}</strong>`;
    const oportunidad = l.importePresupuesto ? formatMoney(l.importePresupuesto) : (l.estadoPresupuesto && l.estadoPresupuesto !== "No aplica" ? "Sin importe" : "-");

    return `<tr class="crm-row ${slug(l.urgencia)}">
      <td>#${l.id}</td>
      <td><strong>${formatFechaES(l.fecha)}</strong><br><small>${l.hora || ""}</small></td>
      <td>${clienteClick}<br><small>${l.telefono || (cliente ? cliente.telefono || "" : "")}</small></td>
      <td>${l.persona || "-"}</td>
      <td>${crmPrioridad(l.urgencia)}</td>
      <td><div class="crm-issue-text">${limitText(l.queSucede, 95)}</div><small>${l.tipo || ""}</small></td>
      <td>${l.avisarA || "-"}</td>
      <td><select onchange="cambiarEstadoLlamada(${l.id}, this.value)">${estadoLlamadaOptions(l.estado)}</select></td>
      <td>${crmSemaforoSeguimiento(l)}<br><small>${l.fechaSeguimiento ? formatFechaES(l.fechaSeguimiento) : "-"} ${l.proximaAccion ? "· " + limitText(l.proximaAccion, 28) : ""}</small></td>
      <td><strong>${oportunidad}</strong><br><small>${l.estadoPresupuesto || "No aplica"}</small></td>
      <td class="crm-actions">
        <button class="icon-btn" onclick="verLlamada(${l.id})">Ver</button>
        <button class="icon-btn" onclick="marcarAvisado(${l.id})">Avisado</button>
        <button class="icon-btn" onclick="editarOportunidad(${l.id})">€</button>
        <button class="icon-btn" onclick="crearCitaDesdeIncidencia(${l.id})">Agenda</button>
        <button class="icon-btn" onclick="eliminarLlamada(${l.id})">Borrar</button>
      </td>
    </tr>`;
  }).join("") || "<tr><td colspan='11'>Sin incidencias.</td></tr>";
}

function renderResumenIncidencias(llamadasFiltradas) {
  const section = document.getElementById("llamadas");
  if (!section) return;
  const panel = section.querySelector(".panel");
  if (!panel) return;
  let box = document.getElementById("crmResumenIncidencias");
  if (!box) {
    box = document.createElement("div");
    box.id = "crmResumenIncidencias";
    box.className = "crm-summary-grid";
    panel.querySelector(".panel-header")?.insertAdjacentElement("afterend", box);
  }
  const todas = getData(STORAGE_KEYS.llamadas);
  const abiertas = todas.filter(l => !isClosed(l.estado)).length;
  const urgentes = todas.filter(l => ["Urgente", "Alta"].includes(l.urgencia)).length;
  const hoy = todayISO();
  const seguimientoHoy = todas.filter(l => !isClosed(l.estado) && l.fechaSeguimiento && l.fechaSeguimiento <= hoy).length;
  const presupuestos = todas.filter(l => l.estadoPresupuesto && l.estadoPresupuesto !== "No aplica").length;
  box.innerHTML = `
    <div class="crm-summary-card"><span>Abiertas</span><strong>${abiertas}</strong></div>
    <div class="crm-summary-card danger"><span>Urgentes / Alta</span><strong>${urgentes}</strong></div>
    <div class="crm-summary-card warning"><span>Seguimiento</span><strong>${seguimientoHoy}</strong></div>
    <div class="crm-summary-card money"><span>Presupuestos</span><strong>${presupuestos}</strong></div>
    <div class="crm-summary-card"><span>Vista actual</span><strong>${llamadasFiltradas.length}</strong></div>`;
}

function estadoLlamadaOptions(actual) {
  const estados = ["Llamada recibida", "Pendiente avisar", "Avisado", "Pendiente respuesta", "Seguimiento pendiente", "Pendiente presupuesto", "Presupuesto enviado", "Aceptado", "Rechazado", "Resuelto", "Cerrado"];
  return estados.map(e => `<option ${e === actual ? "selected" : ""}>${e}</option>`).join("");
}

function cambiarEstadoLlamada(id, estado) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  l.estado = estado;
  if (estado === "Presupuesto enviado") l.estadoPresupuesto = "Enviado";
  if (estado === "Aceptado") l.estadoPresupuesto = "Aceptado";
  if (estado === "Rechazado") l.estadoPresupuesto = "Rechazado";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Cambio de estado", `Estado actualizado a: ${estado}`);
  renderAll();
  showToast("Estado actualizado");
}

function marcarAvisado(id) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  l.estado = "Avisado";
  if (!l.proximaAccion) l.proximaAccion = "Comprobar respuesta";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Avisado", `Avisado a: ${l.avisarA || "sin especificar"}`);
  renderAll();
  showToast("Marcado como avisado");
}

function verLlamada(id) {
  const l = getData(STORAGE_KEYS.llamadas).find(item => item.id === id);
  if (!l) return;
  const seguimientos = getData(STORAGE_KEYS.seguimientos).filter(s => s.llamadaId === id).reverse();
  const cliente = getCliente(l.clienteId);
  const detalle = document.getElementById("detalleLlamada");
  if (!detalle) return;
  detalle.classList.remove("hidden");

  detalle.innerHTML = `
    <div class="panel-header">
      <h3>Incidencia #${l.id} · ${getNombreClienteLlamada(l)}</h3>
      <button class="secondary-btn small" onclick="document.getElementById('detalleLlamada').classList.add('hidden')">Cerrar</button>
    </div>
    <div class="detail-grid">
      <strong>Fecha/Hora</strong><span>${formatFechaES(l.fecha)} ${l.hora || ""}</span>
      <strong>Cliente</strong><span>${getNombreClienteLlamada(l)}</span>
      <strong>Contacto</strong><span>${l.persona || "-"} · ${l.telefono || "-"} · ${l.email || "-"}</span>
      <strong>Dirección cliente</strong><span>${cliente ? cliente.direccion || "-" : "-"}</span>
      <strong>Tipo/Urgencia</strong><span>${l.tipo} · <span class="badge ${slug(l.urgencia)}">${l.urgencia}</span></span>
      <strong>Avisar a</strong><span>${l.avisarA || "-"}</span>
      <strong>Estado</strong><span><span class="badge ${slug(l.estado)}">${l.estado}</span></span>
      <strong>Qué sucede</strong><span>${l.queSucede}</span>
      <strong>Próxima acción</strong><span>${l.proximaAccion || "-"} ${l.fechaSeguimiento ? "· " + formatFechaES(l.fechaSeguimiento) : ""}</span>
      <strong>Presupuesto</strong><span>${l.estadoPresupuesto || "No aplica"} ${l.numeroPresupuesto ? "· " + l.numeroPresupuesto : ""} ${l.importePresupuesto ? "· " + formatMoney(l.importePresupuesto) : ""}</span>
      <strong>Notas</strong><span>${l.notas || "-"}</span>
    </div>
    <hr>
    <div class="form-actions">
      <button class="primary-btn small" onclick="marcarAvisado(${l.id}); verLlamada(${l.id})">Marcar avisado</button>
      <button class="secondary-btn small" onclick="editarProximaAccion(${l.id})">Próxima acción</button>
      <button class="secondary-btn small" onclick="editarPresupuesto(${l.id})">Presupuesto</button>
      <button class="secondary-btn small" onclick="crearCitaDesdeIncidencia(${l.id})">Crear cita</button>
    </div>
    <h4>Añadir seguimiento</h4>
    <div class="form-grid">
      <label>Tipo
        <select id="segTipo">
          <option>Llamada cliente</option><option>Aviso pasado</option><option>Respuesta recibida</option><option>Visita realizada</option>
          <option>Presupuesto pendiente</option><option>Presupuesto enviado</option><option>Pendiente respuesta</option><option>Comentario interno</option><option>Cierre</option>
        </select>
      </label>
      <label>Comentario <input id="segComentario" placeholder="Detalle..."></label>
      <div class="form-actions"><button class="primary-btn" onclick="agregarSeguimientoLlamada(${l.id})">Guardar seguimiento</button></div>
    </div>
    <h4>Historial</h4>
    <div class="timeline">
      ${seguimientos.map(s => `<div class="timeline-item"><strong>${s.fecha} · ${s.tipo}</strong><p>${s.comentario}</p><small>${s.usuario}</small></div>`).join("") || "<p>Sin seguimientos.</p>"}
    </div>
  `;
  showSection("llamadas");
  setTimeout(() => detalle.scrollIntoView({ behavior: "smooth" }), 50);
}

function agregarSeguimientoLlamada(id) {
  const tipo = document.getElementById("segTipo")?.value;
  const comentario = (document.getElementById("segComentario")?.value || "").trim();
  if (!comentario) return showToast("Escribe un comentario");
  crearSeguimiento(id, tipo, comentario);
  renderAll();
  verLlamada(id);
  showToast("Seguimiento añadido");
}

function editarProximaAccion(id) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  const accion = prompt("Próxima acción:", l.proximaAccion || "");
  if (accion === null) return;
  const fecha = prompt("Fecha seguimiento YYYY-MM-DD:", l.fechaSeguimiento || "");
  l.proximaAccion = accion;
  l.fechaSeguimiento = fecha || "";
  if (!isClosed(l.estado)) l.estado = "Seguimiento pendiente";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Próxima acción", `${accion}${fecha ? " · " + formatFechaES(fecha) : ""}`);
  renderAll();
  verLlamada(id);
}

function editarPresupuesto(id) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  const numero = prompt("Número presupuesto:", l.numeroPresupuesto || "");
  if (numero === null) return;
  const estado = prompt("Estado presupuesto: Pendiente / Preparando / Enviado / Aceptado / Rechazado", l.estadoPresupuesto || "Pendiente");
  if (estado === null) return;
  const importe = prompt("Importe presupuesto:", l.importePresupuesto || "");
  l.numeroPresupuesto = numero;
  l.estadoPresupuesto = estado || "Pendiente";
  l.importePresupuesto = importe || "";
  if (estado === "Enviado") l.estado = "Presupuesto enviado";
  if (estado === "Aceptado") l.estado = "Aceptado";
  if (estado === "Rechazado") l.estado = "Rechazado";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Presupuesto", `${numero || "Sin número"} · ${estado || ""} · ${importe ? formatMoney(importe) : ""}`);
  renderAll();
  verLlamada(id);
}

function editarOportunidad(id) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  const importe = prompt("Importe estimado / presupuesto (€):", l.importePresupuesto || "");
  if (importe === null) return;
  l.importePresupuesto = importe || "";
  if (!l.estadoPresupuesto || l.estadoPresupuesto === "No aplica") l.estadoPresupuesto = importe ? "Pendiente" : "No aplica";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Oportunidad económica", importe ? `Importe estimado: ${formatMoney(importe)}` : "Importe eliminado");
  renderAll();
  showToast("Oportunidad actualizada");
}

function eliminarLlamada(id) {
  if (!confirm("¿Eliminar incidencia y seguimientos?")) return;
  saveData(STORAGE_KEYS.llamadas, getData(STORAGE_KEYS.llamadas).filter(l => l.id !== id));
  saveData(STORAGE_KEYS.seguimientos, getData(STORAGE_KEYS.seguimientos).filter(s => s.llamadaId !== id));
  document.getElementById("detalleLlamada")?.classList.add("hidden");
  renderAll();
  showToast("Incidencia eliminada");
}

function crearSeguimiento(llamadaId, tipo, comentario) {
  const seguimientos = getData(STORAGE_KEYS.seguimientos);
  seguimientos.push({ id: getNextId(seguimientos), llamadaId, fecha: new Date().toLocaleString("es-ES"), tipo, comentario, usuario: "Administración" });
  saveData(STORAGE_KEYS.seguimientos, seguimientos);
}

function renderSeguimiento() {
  const filtro = (document.getElementById("buscarSeguimiento")?.value || "").toLowerCase();
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const pendientes = llamadas
    .filter(l => !isClosed(l.estado))
    .filter(l => l.fechaSeguimiento || l.proximaAccion || l.estado === "Pendiente avisar")
    .filter(l => `${getNombreClienteLlamada(l)} ${l.proximaAccion} ${l.estado} ${l.queSucede}`.toLowerCase().includes(filtro))
    .sort((a, b) => String(a.fechaSeguimiento || "9999-99-99").localeCompare(String(b.fechaSeguimiento || "9999-99-99")));

  const tbody = document.getElementById("tablaSeguimientosPendientes");
  if (tbody) {
    tbody.innerHTML = pendientes.map(l => `
      <tr>
        <td>${formatFechaES(l.fechaSeguimiento) || "-"}</td>
        <td><strong>${getNombreClienteLlamada(l)}</strong><br><small>#${l.id}</small></td>
        <td>${l.proximaAccion || (l.estado === "Pendiente avisar" ? "Avisar a " + (l.avisarA || "pendiente") : "Revisar")}</td>
        <td><span class="badge ${slug(l.estado)}">${l.estado}</span></td>
        <td>${l.numeroPresupuesto || "-"}<br><small>${l.estadoPresupuesto || "No aplica"}</small></td>
        <td><button class="icon-btn" onclick="verLlamada(${l.id})">Ver</button><button class="icon-btn" onclick="cambiarEstadoLlamada(${l.id}, 'Resuelto')">Resolver</button></td>
      </tr>
    `).join("") || "<tr><td colspan='6'>No hay seguimientos pendientes.</td></tr>";
  }

  const timeline = document.getElementById("timelineGlobal");
  if (!timeline) return;
  const seguimientos = getData(STORAGE_KEYS.seguimientos)
    .filter(s => {
      const llamada = llamadas.find(l => l.id === s.llamadaId);
      return `${llamada ? getNombreClienteLlamada(llamada) : ""} ${s.tipo} ${s.comentario}`.toLowerCase().includes(filtro);
    }).slice().reverse();

  timeline.innerHTML = seguimientos.map(s => {
    const llamada = llamadas.find(l => l.id === s.llamadaId);
    return `<div class="timeline-item"><strong>${s.fecha} · ${llamada ? getNombreClienteLlamada(llamada) : "Incidencia eliminada"}</strong><p><b>${s.tipo}</b>: ${s.comentario}</p><small>Incidencia #${s.llamadaId}</small></div>`;
  }).join("") || "<p>Sin historial.</p>";
}

function renderPresupuestos() {
  const filtro = (document.getElementById("buscarPresupuestos")?.value || "").toLowerCase();
  const llamadas = getData(STORAGE_KEYS.llamadas)
    .filter(l => l.estadoPresupuesto && l.estadoPresupuesto !== "No aplica")
    .filter(l => `${getNombreClienteLlamada(l)} ${l.numeroPresupuesto} ${l.estadoPresupuesto} ${l.queSucede}`.toLowerCase().includes(filtro));

  const tbody = document.getElementById("tablaPresupuestos");
  if (!tbody) return;
  tbody.innerHTML = llamadas.slice().reverse().map(l => `
    <tr>
      <td>#${l.id}</td>
      <td><strong>${getNombreClienteLlamada(l)}</strong></td>
      <td><input value="${l.numeroPresupuesto || ""}" onchange="actualizarCampoLlamada(${l.id}, 'numeroPresupuesto', this.value)"></td>
      <td><select onchange="actualizarPresupuestoEstado(${l.id}, this.value)">${estadoPresupuestoOptions(l.estadoPresupuesto)}</select></td>
      <td><input type="number" step="0.01" value="${l.importePresupuesto || ""}" onchange="actualizarCampoLlamada(${l.id}, 'importePresupuesto', this.value)"></td>
      <td><input value="${l.notas || ""}" onchange="actualizarCampoLlamada(${l.id}, 'notas', this.value)"></td>
      <td><button class="icon-btn" onclick="verLlamada(${l.id})">Ver</button><button class="icon-btn" onclick="abrirEmailPresupuesto(${l.id})">Email</button></td>
    </tr>
  `).join("") || "<tr><td colspan='7'>No hay presupuestos registrados.</td></tr>";
}

function estadoPresupuestoOptions(actual) {
  const estados = ["Pendiente", "Preparando", "Enviado", "Aceptado", "Rechazado"];
  return estados.map(e => `<option ${e === actual ? "selected" : ""}>${e}</option>`).join("");
}

function actualizarCampoLlamada(id, field, value) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  l[field] = value;
  saveData(STORAGE_KEYS.llamadas, llamadas);
  renderAll();
}

function actualizarPresupuestoEstado(id, estado) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  l.estadoPresupuesto = estado;
  if (estado === "Enviado") l.estado = "Presupuesto enviado";
  if (estado === "Aceptado") l.estado = "Aceptado";
  if (estado === "Rechazado") l.estado = "Rechazado";
  saveData(STORAGE_KEYS.llamadas, llamadas);
  crearSeguimiento(id, "Estado presupuesto", `Presupuesto ${l.numeroPresupuesto || ""}: ${estado}`);
  renderAll();
  showToast("Presupuesto actualizado");
}

function abrirEmailPresupuesto(id) {
  const l = getData(STORAGE_KEYS.llamadas).find(item => item.id === id);
  if (!l) return;
  const cliente = getCliente(l.clienteId);
  const email = l.email || (cliente ? cliente.email : "");
  const subject = encodeURIComponent(`Presupuesto ${l.numeroPresupuesto || ""}`);
  const body = encodeURIComponent(`Hola ${l.persona || ""},\n\nTe envío información sobre el presupuesto ${l.numeroPresupuesto || ""}.\n\nCliente: ${getNombreClienteLlamada(l)}\nMotivo: ${l.queSucede}\nImporte: ${l.importePresupuesto ? formatMoney(l.importePresupuesto) : ""}\n\nQuedo pendiente de tu respuesta.\n\nUn saludo.`);
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

/* CLIENTES */
function normalizarHeader(text) {
  return String(text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [], current = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') { current += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if ((char === "," || char === ";") && !inQuotes) { row.push(current.trim()); current = ""; }
    else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current || row.length) { row.push(current.trim()); rows.push(row); }
      row = []; current = "";
      if (char === "\r" && next === "\n") i++;
    } else current += char;
  }
  if (current || row.length) { row.push(current.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c));
}

function importarClientesCSV() {
  const input = document.getElementById("csvClientes");
  const file = input?.files[0];
  if (!file) return showToast("Selecciona un CSV");

  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (rows.length < 2) return showToast("CSV vacío o inválido");
    const headers = rows[0].map(normalizarHeader);
    const clientes = getData(STORAGE_KEYS.clientes);
    let actualizados = 0, nuevos = 0;

    const mapIndex = possible => {
      for (const name of possible) {
        const idx = headers.indexOf(name);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idx = {
      codigo: mapIndex(["codigo", "cod", "id", "codigo cliente"]),
      nombre: mapIndex(["nombre", "cliente", "empresa", "razon social", "nombre cliente"]),
      contacto: mapIndex(["contacto", "persona contacto", "persona"]),
      telefono: mapIndex(["telefono", "teléfono", "movil", "móvil", "phone"]),
      email: mapIndex(["email", "correo", "mail", "e-mail"]),
      direccion: mapIndex(["direccion", "dirección", "domicilio", "address"])
    };

    if (idx.nombre < 0) return showToast("El CSV necesita columna cliente/nombre");

    rows.slice(1).forEach(r => {
      const cliente = {
        codigo: idx.codigo >= 0 ? r[idx.codigo] : "",
        nombre: r[idx.nombre] || "",
        contacto: idx.contacto >= 0 ? r[idx.contacto] : "",
        telefono: idx.telefono >= 0 ? r[idx.telefono] : "",
        email: idx.email >= 0 ? r[idx.email] : "",
        direccion: idx.direccion >= 0 ? r[idx.direccion] : ""
      };
      if (!cliente.nombre) return;

      const existente = clientes.find(c => (cliente.codigo && c.codigo === cliente.codigo) || c.nombre.toLowerCase() === cliente.nombre.toLowerCase());
      if (existente) { Object.assign(existente, cliente); actualizados++; }
      else { clientes.push({ id: getNextId(clientes), ...cliente }); nuevos++; }
    });

    saveData(STORAGE_KEYS.clientes, clientes);
    renderAll();
    showToast(`Importación OK: ${nuevos} nuevos, ${actualizados} actualizados`);
    input.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function renderClientes() {
  const filtro = (document.getElementById("buscarClientes")?.value || "").toLowerCase();
  const clientes = getData(STORAGE_KEYS.clientes).filter(c => `${c.codigo} ${c.nombre} ${c.contacto} ${c.telefono} ${c.email} ${c.direccion}`.toLowerCase().includes(filtro));
  const tbody = document.getElementById("tablaClientes");
  if (!tbody) return;
  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td>${c.codigo || "-"}</td><td><strong>${c.nombre}</strong></td><td>${c.contacto || "-"}</td>
      <td>${c.telefono || "-"}</td><td>${c.email || "-"}</td><td>${c.direccion || "-"}</td>
    </tr>
  `).join("") || "<tr><td colspan='6'>Sin clientes importados.</td></tr>";
}

function renderClientesDatalist() {
  const clientes = getData(STORAGE_KEYS.clientes);
  const list = document.getElementById("clientesDatalist");
  if (!list) return;
  list.innerHTML = clientes.map(c => `<option value="${c.nombre} | ${c.codigo || ""} | ${c.telefono || ""}"></option>`).join("");
}

function findClienteBySearch(value) {
  value = String(value || "").toLowerCase();
  const base = value.split("|")[0].trim();
  return getData(STORAGE_KEYS.clientes).find(c =>
    c.nombre.toLowerCase() === base ||
    (c.codigo && value.includes(c.codigo.toLowerCase())) ||
    (c.telefono && value.includes(c.telefono.toLowerCase()))
  );
}

function seleccionarClienteBuscado(event) {
  const c = findClienteBySearch(event.target.value);
  const box = document.getElementById("clienteEncontrado");
  if (c) {
    document.getElementById("llClienteId").value = c.id;
    document.getElementById("llClienteManual").value = "";
    document.getElementById("llPersona").value = c.contacto || "";
    document.getElementById("llTelefono").value = c.telefono || "";
    document.getElementById("llEmail").value = c.email || "";
    box.innerHTML = `<strong>Cliente seleccionado:</strong> ${c.nombre}<br>${c.contacto || ""} · ${c.telefono || ""} · ${c.direccion || ""}`;
  } else {
    document.getElementById("llClienteId").value = "";
    if (box) box.innerHTML = "Cliente no seleccionado. Puedes escribir el nombre manualmente.";
  }
}

function getCliente(id) {
  return getData(STORAGE_KEYS.clientes).find(c => c.id === Number(id));
}

function getNombreClienteLlamada(llamada) {
  const cliente = getCliente(llamada.clienteId);
  return cliente ? cliente.nombre : (llamada.clienteManual || "Cliente sin nombre");
}

function verFichaCliente(clienteId) {
  const cliente = getCliente(clienteId);
  if (!cliente) return;
  const llamadas = getData(STORAGE_KEYS.llamadas).filter(l => Number(l.clienteId) === Number(clienteId));
  const abiertas = llamadas.filter(l => !isClosed(l.estado));
  const presupuestos = llamadas.filter(l => l.estadoPresupuesto && l.estadoPresupuesto !== "No aplica");
  const agenda = getAgenda().filter(a => String(a.cliente || "").toLowerCase().includes(String(cliente.nombre || "").toLowerCase()));

  let modal = document.getElementById("clienteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "clienteModal";
    modal.className = "modal hidden";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content cliente-ficha">
      <button class="modal-close" onclick="document.getElementById('clienteModal').classList.add('hidden')">×</button>
      <h2>👥 ${cliente.nombre}</h2>
      <p class="muted">${cliente.codigo || ""} ${cliente.direccion ? "· " + cliente.direccion : ""}</p>
      <div class="crm-client-kpis">
        <div><span>Incidencias</span><strong>${llamadas.length}</strong></div>
        <div><span>Abiertas</span><strong>${abiertas.length}</strong></div>
        <div><span>Presupuestos</span><strong>${presupuestos.length}</strong></div>
        <div><span>Citas agenda</span><strong>${agenda.length}</strong></div>
      </div>
      <div class="detail-grid">
        <strong>Contacto</strong><span>${cliente.contacto || "-"}</span>
        <strong>Teléfono</strong><span>${cliente.telefono || "-"}</span>
        <strong>Email</strong><span>${cliente.email || "-"}</span>
        <strong>Dirección</strong><span>${cliente.direccion || "-"}</span>
      </div>
      <h3>Últimas incidencias</h3>
      <div class="timeline">
        ${llamadas.length ? llamadas.slice().reverse().slice(0, 8).map(l => `
          <div class="timeline-item">
            <strong>#${l.id} · ${formatFechaES(l.fecha)} · ${l.estado}</strong>
            <p>${l.queSucede || ""}</p><small>${l.proximaAccion || ""}</small>
          </div>`).join("") : "<p>Sin incidencias registradas.</p>"}
      </div>
    </div>`;
  modal.classList.remove("hidden");
}

/* AGENDA */
function crearTareaAgenda() {
  const agenda = getAgenda();
  const fecha = prompt("Fecha YYYY-MM-DD:", todayISO());
  if (!fecha) return;
  const hora = prompt("Hora HH:MM:", "09:00") || "";
  const tipo = prompt("Tipo: Visita / Llamada / Reunión / Tarea", "Visita") || "Visita";
  const cliente = prompt("Cliente:", "") || "";
  const descripcion = prompt("Descripción:", "");
  if (!descripcion) return;
  const prioridad = prompt("Prioridad: Normal / Alta / Urgente", "Normal") || "Normal";
  agenda.push({ id: Date.now(), fecha, hora, tipo, cliente, descripcion, estado: "Pendiente", prioridad });
  saveAgenda(agenda);
  renderAgenda();
  showToast("Cita añadida");
}

function crearCitaDesdeIncidencia(id) {
  const llamadas = getData(STORAGE_KEYS.llamadas);
  const l = llamadas.find(item => item.id === id);
  if (!l) return;
  const agenda = getAgenda();
  const fecha = prompt("Fecha de la cita YYYY-MM-DD:", l.fechaSeguimiento || todayISO());
  if (!fecha) return;
  const hora = prompt("Hora HH:MM:", "09:00") || "";
  const tipo = prompt("Tipo: Visita / Llamada / Reunión / Tarea", "Visita") || "Visita";
  const cliente = getNombreClienteLlamada(l);
  const descripcion = prompt("Descripción:", l.proximaAccion || l.queSucede || "") || l.queSucede || "";
  agenda.push({ id: Date.now(), fecha, hora, tipo, cliente, descripcion, estado: "Pendiente", prioridad: l.urgencia || "Normal", llamadaId: l.id });
  saveAgenda(agenda);
  crearSeguimiento(id, "Cita creada", `${tipo} · ${formatFechaES(fecha)} ${hora}`);
  renderAll();
  showToast("Cita creada en agenda");
}

function cambiarMesAgenda(cambio) {
  agendaMesActual.setMonth(agendaMesActual.getMonth() + cambio);
  renderAgenda();
}

function renderAgenda() {
  const grid = document.getElementById("agendaCalendario");
  const titulo = document.getElementById("agendaMesTitulo");
  if (!grid || !titulo) return;

  const year = agendaMesActual.getFullYear();
  const month = agendaMesActual.getMonth();

  titulo.textContent = agendaMesActual.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).toUpperCase();

  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  let inicioSemana = primerDia.getDay();
  if (inicioSemana === 0) inicioSemana = 7;
  const totalDias = ultimoDia.getDate();
  const agenda = getAgenda();
  const hoy = todayISO();

  grid.innerHTML = "";

  for (let i = 1; i < inicioSemana; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    grid.appendChild(empty);
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const fechaISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const citasDia = agenda.filter(t => t.fecha === fechaISO).sort((a,b) => String(a.hora || "").localeCompare(String(b.hora || "")));
    const day = document.createElement("div");
    day.className = "calendar-day";
    if (fechaISO === hoy) day.classList.add("today");

    day.innerHTML = `
      <div class="calendar-day-number">${dia}</div>
      <div class="calendar-events">
        ${citasDia.slice(0, 3).map(t => `<div class="calendar-event ${slug(t.tipo)} ${slug(t.prioridad)}">${t.hora || ""} ${t.cliente || t.descripcion}</div>`).join("")}
      </div>
      ${citasDia.length > 3 ? `<div class="calendar-more">+${citasDia.length - 3} más</div>` : ""}`;
    day.addEventListener("click", () => verDetalleDiaAgenda(fechaISO));
    grid.appendChild(day);
  }
}

function verDetalleDiaAgenda(fechaISO) {
  const panel = document.getElementById("agendaDetalleDia");
  if (!panel) return;
  const agenda = getAgenda().filter(t => t.fecha === fechaISO).sort((a,b) => String(a.hora || "").localeCompare(String(b.hora || "")));
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="panel-header">
      <h3>📅 ${formatFechaLarga(fechaISO)}</h3>
      <button class="secondary-btn small" onclick="document.getElementById('agendaDetalleDia').classList.add('hidden')">Cerrar</button>
    </div>
    ${agenda.length ? agenda.map(t => `
      <div class="agenda-day-item">
        <strong>${t.hora || ""} · ${t.tipo}</strong>
        <p>${t.descripcion}</p>
        <small>${t.cliente || ""} · ${t.estado || "Pendiente"} · ${t.prioridad || "Normal"}</small>
        <div class="form-actions" style="margin-top:10px">
          <button class="icon-btn" onclick="marcarCitaRealizada(${t.id})">Realizada</button>
          <button class="icon-btn" onclick="eliminarCitaAgenda(${t.id})">Borrar</button>
        </div>
      </div>`).join("") : "<p>No hay citas.</p>"}`;
}

function marcarCitaRealizada(id) {
  const agenda = getAgenda();
  const t = agenda.find(x => x.id === id);
  if (!t) return;
  t.estado = "Realizada";
  saveAgenda(agenda);
  renderAgenda();
  verDetalleDiaAgenda(t.fecha);
}

function eliminarCitaAgenda(id) {
  if (!confirm("¿Eliminar cita?")) return;
  const agenda = getAgenda();
  const cita = agenda.find(x => x.id === id);
  saveAgenda(agenda.filter(x => x.id !== id));
  renderAgenda();
  if (cita) verDetalleDiaAgenda(cita.fecha);
}

/* REPORTE */
function getInicioSemana(date = new Date()) {
  const d = new Date(date);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFinSemana(date = new Date()) {
  const inicio = getInicioSemana(date);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

function fechaISODesdeDate(date) { return date.toISOString().slice(0, 10); }
function fechaES(fecha) { return formatFechaES(fecha); }
function enRangoSemana(fecha, inicioISO, finISO) { return fecha && fecha >= inicioISO && fecha <= finISO; }

function generarReporteSemanal() {
  const clientes = getData(STORAGE_KEYS.clientes);
  const incidencias = getData(STORAGE_KEYS.llamadas);
  const agenda = getAgenda();

  const inicio = getInicioSemana();
  const fin = getFinSemana();
  const inicioISO = fechaISODesdeDate(inicio);
  const finISO = fechaISODesdeDate(fin);

  const agendaSemana = agenda.filter(a => enRangoSemana(a.fecha, inicioISO, finISO));
  const visitasSemana = agendaSemana.filter(a => String(a.tipo || "").toLowerCase().includes("visita"));
  const llamadasSemana = agendaSemana.filter(a => String(a.tipo || "").toLowerCase().includes("llamada"));
  const reunionesSemana = agendaSemana.filter(a => String(a.tipo || "").toLowerCase().includes("reun"));
  const tareasPendientes = agendaSemana.filter(a => a.estado !== "Realizada" && a.estado !== "Cancelada");

  const incidenciasSemana = incidencias.filter(i => enRangoSemana(i.fecha, inicioISO, finISO));
  const incidenciasAbiertas = incidencias.filter(i => !isClosed(i.estado));
  const pendientesAvisar = incidencias.filter(i => i.estado === "Pendiente avisar");

  const presupuestosPendientes = incidencias.filter(i => ["Pendiente", "Preparando"].includes(i.estadoPresupuesto));
  const presupuestosEnviados = incidencias.filter(i => i.estadoPresupuesto === "Enviado");
  const presupuestosAceptados = incidencias.filter(i => i.estadoPresupuesto === "Aceptado");

  const html = `
    <div class="reporte-header">
      <div><h1>Reporte semanal VILAHEXDOSS</h1><p>${fechaES(inicioISO)} - ${fechaES(finISO)}</p></div>
      <div class="reporte-logo">VH</div>
    </div>
    <div class="reporte-kpis">
      <div><span>Clientes</span><strong>${clientes.length}</strong></div>
      <div><span>Incidencias semana</span><strong>${incidenciasSemana.length}</strong></div>
      <div><span>Abiertas</span><strong>${incidenciasAbiertas.length}</strong></div>
      <div><span>Pendientes avisar</span><strong>${pendientesAvisar.length}</strong></div>
      <div><span>Presupuestos pendientes</span><strong>${presupuestosPendientes.length}</strong></div>
      <div><span>Citas semana</span><strong>${agendaSemana.length}</strong></div>
    </div>
    <div class="reporte-section">
      <h2>🗓️ Agenda comercial</h2>
      <div class="reporte-mini-grid">
        <div>🚗 Visitas <strong>${visitasSemana.length}</strong></div>
        <div>☎️ Llamadas <strong>${llamadasSemana.length}</strong></div>
        <div>🤝 Reuniones <strong>${reunionesSemana.length}</strong></div>
        <div>⏳ Pendientes <strong>${tareasPendientes.length}</strong></div>
      </div>
    </div>
    <div class="reporte-section"><h2>🚗 Visitas de la semana</h2>${crearListaReporte(visitasSemana, "Sin visitas registradas esta semana")}</div>
    <div class="reporte-section"><h2>🚨 Incidencias abiertas</h2>${crearListaIncidenciasReporte(incidenciasAbiertas, "Sin incidencias abiertas")}</div>
    <div class="reporte-section">
      <h2>💶 Presupuestos</h2>
      <div class="reporte-mini-grid">
        <div>🟠 Pendientes <strong>${presupuestosPendientes.length}</strong></div>
        <div>📤 Enviados <strong>${presupuestosEnviados.length}</strong></div>
        <div>✅ Aceptados <strong>${presupuestosAceptados.length}</strong></div>
      </div>
      ${crearListaPresupuestosReporte(presupuestosPendientes)}
    </div>`;

  mostrarReporteSemanal(html);
}

function crearListaReporte(items, textoVacio) {
  if (!items.length) return `<p class="reporte-empty">${textoVacio}</p>`;
  return `<div class="reporte-lista">${items.map(i => `
    <div class="reporte-item"><strong>${fechaES(i.fecha)} ${i.hora || ""} · ${i.tipo || ""}</strong><p>${i.cliente || "Sin cliente"}</p><small>${i.descripcion || ""} · ${i.estado || "Pendiente"}</small></div>
  `).join("")}</div>`;
}

function crearListaIncidenciasReporte(items, textoVacio) {
  if (!items.length) return `<p class="reporte-empty">${textoVacio}</p>`;
  return `<div class="reporte-lista">${items.map(i => `
    <div class="reporte-item"><strong>#${i.id} · ${getNombreClienteLlamada(i)}</strong><p>${i.queSucede || ""}</p><small>${i.estado || ""} · ${i.proximaAccion || ""}</small></div>
  `).join("")}</div>`;
}

function crearListaPresupuestosReporte(items) {
  if (!items.length) return `<p class="reporte-empty">Sin presupuestos pendientes</p>`;
  return `<div class="reporte-lista">${items.map(p => `
    <div class="reporte-item"><strong>${p.numeroPresupuesto || "Sin nº"} · ${getNombreClienteLlamada(p)}</strong><p>${p.estadoPresupuesto}</p><small>${p.importePresupuesto ? formatMoney(p.importePresupuesto) : "Sin importe"}</small></div>
  `).join("")}</div>`;
}

function mostrarReporteSemanal(html) {
  let modal = document.getElementById("reporteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "reporteModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content reporte-content">
        <button class="modal-close" onclick="document.getElementById('reporteModal').classList.add('hidden')">×</button>
        <div id="reporteHTML"></div>
        <div class="form-actions no-print" style="margin-top:18px">
          <button class="primary-btn" onclick="imprimirReporteSemanal()">Imprimir / Guardar PDF</button>
          <button class="secondary-btn" onclick="copiarReporteSemanal()">Copiar texto</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById("reporteHTML").innerHTML = html;
  modal.classList.remove("hidden");
}

function copiarReporteSemanal() {
  const texto = document.getElementById("reporteHTML")?.innerText || "";
  navigator.clipboard.writeText(texto);
  showToast("Reporte copiado");
}

function imprimirReporteSemanal() { window.print(); }

/* BACKUPS */
function exportAllData() {
  const data = {
    version: "VILAHEXDOSS CRM v1.0",
    exportedAt: new Date().toISOString(),
    clientes: getData(STORAGE_KEYS.clientes),
    llamadas: getData(STORAGE_KEYS.llamadas),
    seguimientos: getData(STORAGE_KEYS.seguimientos),
    agenda: getAgenda()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vilahexdoss-crm-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Copia descargada");
}

function importarBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = safeParse(e.target.result, null);
    if (!data) return showToast("Archivo no válido");
    if (!confirm("Esto importará la copia seleccionada. ¿Continuar?")) return;
    saveData(STORAGE_KEYS.clientes, data.clientes || []);
    saveData(STORAGE_KEYS.llamadas, data.llamadas || []);
    saveData(STORAGE_KEYS.seguimientos, data.seguimientos || []);
    saveAgenda(data.agenda || []);
    renderAll();
    showToast("Copia importada");
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}
