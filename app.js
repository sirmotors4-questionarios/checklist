const config = window.CHECKLIST_CONFIG || {};
const form = document.querySelector('#checklistForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');

const groups = {
  geral: [
    ['limpeza', 'Limpeza'], ['farol', 'Faróis'], ['portasMacanetas', 'Portas e maçanetas'],
    ['refletores', 'Reflectores'], ['chaparia', 'Chaparia'], ['estadoPneus', 'Estado geral dos pneus'],
    ['nivelAguaRadiador', 'Nível de água no radiador'], ['nivelLiquidoVidros', 'Nível do líquido dos vidros'],
    ['nivelOleoDireccao', 'Nível do óleo de direcção'], ['nivelOleoTravoes', 'Nível do óleo de travões'],
    ['fugasOleo', 'Fugas de óleo'], ['bateria', 'Bateria'], ['luzesTravao', 'Luzes de travão'],
    ['luzesRetaguarda', 'Luzes de retaguarda'], ['luzesPresenca', 'Luzes de presença'],
    ['luzesMinimos', 'Luzes de mínimos'], ['luzesMedios', 'Luzes de médios'],
    ['luzesMaximos', 'Luzes de máximos'], ['luzesNevoeiro', 'Luzes de nevoeiro'],
    ['placas', 'Placas de matrícula'], ['buzina', 'Buzina'], ['pirilampos', 'Pirilampos'],
    ['arCondicionado', 'Ar condicionado'], ['limpaParaBrisas', 'Limpa-para-brisas'],
    ['sistemaAbs', 'Sistema ABS'], ['retrovisoresExternos', 'Retrovisores exteriores'],
    ['caixaPrimeirosSocorros', 'Caixa de primeiros socorros'], ['extintor', 'Extintor'],
    ['coleteReflector', 'Colete reflector'], ['triangulos', 'Triângulos'],
    ['cintosSeguranca', 'Cintos de segurança'], ['espelhoInterior', 'Espelho retrovisor interior'],
    ['tampaCombustivel', 'Tampa de combustível'], ['vidros', 'Vidros']
  ],
  mecanica: [
    ['rolamentos', 'Rolamentos'], ['caixaVelocidades', 'Caixa de velocidades'], ['balatas', 'Balatas'],
    ['calcos', 'Calços'], ['escape', 'Escape'], ['travoes', 'Travões']
  ],
  pneus: [
    ['pneuFrentePassageiro', 'Frente — passageiro'], ['pneuFrenteMotorista', 'Frente — motorista'],
    ['pneuTraseiroPassageiro', 'Traseiro — passageiro'], ['pneuTraseiroMotorista', 'Traseiro — motorista']
  ]
};

const allChecks = Object.values(groups).flat();
const normalise = value => String(value ?? '').trim();

function renderChecks(targetId, items) {
  document.querySelector(`#${targetId}`).innerHTML = items.map(([key, label]) => `
    <fieldset class="check-item">
      <legend>${label} *</legend>
      <label class="ok"><input type="radio" name="${key}" value="OK" required><span>OK</span></label>
      <label class="bad"><input type="radio" name="${key}" value="NÃO OK" required><span>NÃO OK</span></label>
      <label class="na"><input type="radio" name="${key}" value="N/A" required><span>N/A</span></label>
    </fieldset>`).join('');
}

function setToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  form.elements.data.value = local.toISOString().slice(0, 10);
  document.querySelector('#todayLabel').textContent = new Intl.DateTimeFormat('pt-MZ', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(now);
}

function displayValue(item, type) {
  if (typeof item === 'string') return item;
  if (type === 'viaturas') return item.codigo || item.matricula || item.Frota || '';
  return item.codigo || item.nome || item.Motorista || '';
}

function isActive(item) {
  if (typeof item === 'string') return true;
  const state = normalise(item.estado || item.Estado).toLowerCase();
  return !state || ['activo', 'activa', 'operacional', 'disponível', 'disponivel'].includes(state);
}

function fillSelect(type, items = []) {
  const select = document.querySelector(`[data-list="${type}"]`);
  const options = items.filter(isActive).map(item => displayValue(item, type)).filter(Boolean);
  select.innerHTML = '<option value="">Seleccionar</option>' + options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

async function loadMasterData() {
  try {
    const url = config.masterDataUrl;
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Listas indisponíveis');
    const data = await response.json();
    fillSelect('viaturas', data.viaturas);
    fillSelect('motoristas', data.motoristas);
    const updated = data.actualizadoEm ? new Date(data.actualizadoEm) : new Date();
    document.querySelector('#dataTimestamp').textContent = `Listas actualizadas: ${new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'short', timeStyle: 'short' }).format(updated)}`;
    syncStatus.className = 'sync online';
    syncStatus.innerHTML = '<span></span>Dados actualizados';
  } catch (error) {
    syncStatus.className = 'sync error';
    syncStatus.innerHTML = '<span></span>Falha na actualização';
    document.querySelectorAll('select[data-list]').forEach(select => select.innerHTML = '<option value="">Lista indisponível</option>');
  }
}

function escapeHtml(value) {
  return normalise(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

function checklistResult() {
  const failed = allChecks.filter(([key]) => form.elements[key]?.value === 'NÃO OK').map(([, label]) => label);
  const answered = allChecks.filter(([key]) => form.elements[key]?.value).length;
  return { estado: answered === allChecks.length ? (failed.length ? 'NÃO APTO' : 'APTO') : 'PENDENTE', incidente: failed.join('; ') };
}

function updateResult() {
  const { estado, incidente } = checklistResult();
  const box = document.querySelector('#resultBox');
  box.dataset.state = estado;
  document.querySelector('#estadoPreview').textContent = estado === 'NÃO APTO' ? 'Não apto para saída' : estado === 'APTO' ? 'Apto para saída' : 'Pendente';
  document.querySelector('#incidentPreview').textContent = incidente || (estado === 'APTO' ? 'Nenhuma anomalia identificada.' : 'Complete todas as verificações.');
}

function updateProgress() {
  const requiredNames = new Set([...form.querySelectorAll('[required]')].map(field => field.name));
  const complete = [...requiredNames].filter(name => normalise(form.elements[name]?.value)).length;
  const pct = Math.round((complete / requiredNames.size) * 100);
  document.querySelector('#progressText').textContent = `${pct}%`;
  document.querySelector('#progressBar').style.width = `${pct}%`;
  updateResult();
}

form.addEventListener('input', event => {
  event.target.classList.remove('invalid');
  updateProgress();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const requiredNames = new Set([...form.querySelectorAll('[required]')].map(field => field.name));
  const missing = [...requiredNames].filter(name => !normalise(form.elements[name]?.value));
  if (missing.length) {
    document.querySelector('#formHint').textContent = 'Preencha todos os campos obrigatórios.';
    form.elements[missing[0]]?.focus();
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const result = checklistResult();
  payload.estado = result.estado;
  payload.incidente = result.incidente;
  payload.registadoEm = new Date().toISOString();
  payload.origem = 'web-checklist-saida';

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'A enviar...';
  try {
    if (config.submissionUrl && !config.demoMode) {
      const response = await fetch(config.submissionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Submissão recusada: ${response.status}`);
    } else {
      const entries = JSON.parse(localStorage.getItem('sirChecklistSaidaDemo') || '[]');
      entries.push(payload);
      localStorage.setItem('sirChecklistSaidaDemo', JSON.stringify(entries));
    }
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector('#successMessage').textContent = config.demoMode ? 'Modo de demonstração: o checklist ficou guardado neste dispositivo.' : 'O checklist foi registado na base operacional.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    document.querySelector('#formHint').textContent = 'Não foi possível enviar. Confirme a ligação e tente novamente.';
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Enviar checklist';
  }
});

document.querySelector('#newEntry').addEventListener('click', () => {
  form.reset(); setToday(); form.hidden = false; successPanel.hidden = true;
  document.querySelector('#formHint').textContent = 'Confirme os dados antes de enviar.';
  updateProgress();
});

renderChecks('geralChecks', groups.geral);
renderChecks('mecanicaChecks', groups.mecanica);
renderChecks('pneusChecks', groups.pneus);
setToday();
loadMasterData();
updateProgress();
