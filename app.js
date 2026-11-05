const config = window.CHECKLIST_CONFIG || {};
const form = document.querySelector('#checklistForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');
const ENDPOINT_STORAGE = 'sirChecklistSubmissionEndpoint';
const endpointInput = document.querySelector('#submissionEndpoint');
const endpointStatus = document.querySelector('#apiSettingsStatus');
const endpointSection = document.querySelector('#apiSettings');
function savedEndpoint() {
  try { return localStorage.getItem(ENDPOINT_STORAGE) || ''; } catch { return ''; }
}
function validEndpoint(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = host.endsWith('.environment.api.powerplatform.com') ||
      host.endsWith('.logic.azure.com') || host.endsWith('.azure-apim.net');
    return url.protocol === 'https:' && allowed &&
      url.pathname.includes('/triggers/') && url.pathname.endsWith('/invoke') &&
      url.searchParams.has('sig') && Boolean(url.searchParams.get('sig'));
  } catch { return false; }
}
function submissionEndpoint() {
  const privateUrl = savedEndpoint();
  if (validEndpoint(privateUrl)) return privateUrl;
  return validEndpoint(config.submissionUrl || '') ? config.submissionUrl : '';
}
function refreshEndpointStatus() {
  const ready = Boolean(submissionEndpoint());
  endpointSection.dataset.ready = String(ready);
  endpointStatus.textContent = ready
    ? 'Ligação configurada. Pode submeter o checklist.'
    : 'Ligação incompleta. Cole e guarde o URL HTTP completo do gatilho Power Automate antes de enviar.';
  return ready;
}
document.querySelector('#saveSubmissionEndpoint').addEventListener('click', () => {
  const value = endpointInput.value.trim();
  if (!validEndpoint(value)) {
    endpointStatus.textContent = 'URL inválido ou incompleto. Copie o URL HTTP completo do gatilho após guardar o fluxo público.';
    return;
  }
  try {
    localStorage.setItem(ENDPOINT_STORAGE, value);
    endpointInput.value = '';
    refreshEndpointStatus();
  } catch {
    endpointStatus.textContent = 'Não foi possível guardar neste navegador; verifique o armazenamento local.';
  }
});
document.querySelector('#clearSubmissionEndpoint').addEventListener('click', () => {
  try { localStorage.removeItem(ENDPOINT_STORAGE); } catch {}
  endpointInput.value = '';
  refreshEndpointStatus();
});
refreshEndpointStatus();


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

// Opções adequadas ao significado da verificação.
// Os valores enviados mantêm OK/NÃO OK para compatibilidade com o fluxo Excel existente.
const presenceChecks = new Set(['caixaPrimeirosSocorros', 'coleteReflector', 'triangulos']);
function checkOptions(key) {
  if (key === 'fugasOleo') {
    // Fuga presente é uma anomalia: TEM corresponde a NÃO OK.
    return [
      { label: 'TEM', value: 'NÃO OK', className: 'bad' },
      { label: 'NÃO TEM', value: 'OK', className: 'ok' },
      { label: 'N/A', value: 'N/A', className: 'na' }
    ];
  }
  if (presenceChecks.has(key)) {
    return [
      { label: 'TEM', value: 'OK', className: 'ok' },
      { label: 'NÃO TEM', value: 'NÃO OK', className: 'bad' },
      { label: 'N/A', value: 'N/A', className: 'na' }
    ];
  }
  return [
    { label: 'OK', value: 'OK', className: 'ok' },
    { label: 'NÃO OK', value: 'NÃO OK', className: 'bad' },
    { label: 'N/A', value: 'N/A', className: 'na' }
  ];
}
function renderChecks(targetId, items) {
  document.querySelector(`#${targetId}`).innerHTML = items.map(([key, label]) => `
    <fieldset class="check-item">
      <legend>${label} *</legend>
      ${checkOptions(key).map(option => `<label class="${option.className}"><input type="radio" name="${key}" value="${option.value}" required><span>${option.label}</span></label>`).join('')}
    </fieldset>`).join('');
}

// Preenchimento rápido: só actualiza os botões de verificação (nunca submete).
function preencherChecklistEmLote(valor) {
  const nome = valor === 'OK' ? 'TUDO BEM' : 'TUDO MAU';
  const confirmado = window.confirm(
    'Confirma "' + nome + '" para todas as verificações?\\n' +
    'Esta opção deve reflectir uma inspecção real. Pode corrigir respostas individualmente antes de enviar.'
  );
  if (!confirmado) return;
  let preenchidos = 0;
  allChecks.forEach(([key]) => {
    const radio = [...form.querySelectorAll('input[type="radio"]')]
      .find(input => input.name === key && input.value === valor);
    if (!radio) return;
    radio.checked = true;
    preenchidos++;
  });
  updateProgress();
  document.querySelector('#bulkCheckFeedback').textContent =
    preenchidos + ' verificações seleccionadas como ' + nome +
    '. Reveja e corrija as respostas antes do envio.';
}
document.querySelector('#markAllGood').addEventListener('click', () => preencherChecklistEmLote('OK'));
document.querySelector('#markAllBad').addEventListener('click', () => preencherChecklistEmLote('NÃO OK'));

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

// Classificação preliminar calculada exclusivamente para o registo concluído.
// Critérios de triagem, não substituem a avaliação técnica ou autorização de saída.
const CRITERIOS = {
  impeditivos: new Set([
    'travoes','balatas','calcos','sistemaAbs','cintosSeguranca',
    'estadoPneus','pneuFrentePassageiro','pneuFrenteMotorista',
    'pneuTraseiroPassageiro','pneuTraseiroMotorista','nivelOleoTravoes'
  ]),
  criticos: new Set([
    'nivelOleoDireccao','fugasOleo','portasMacanetas','luzesTravao',
    'caixaVelocidades','rolamentos','nivelAguaRadiador'
  ]),
  importantes: new Set([
    'farol','refletores','nivelLiquidoVidros','bateria','luzesRetaguarda',
    'luzesPresenca','luzesMinimos','luzesMedios','luzesMaximos',
    'luzesNevoeiro','placas','buzina','pirilampos','limpaParaBrisas',
    'retrovisoresExternos','caixaPrimeirosSocorros','extintor',
    'coleteReflector','triangulos','espelhoInterior','tampaCombustivel',
    'vidros','escape'
  ])
};
function pesoChecklist(key) {
  if (CRITERIOS.impeditivos.has(key) || CRITERIOS.criticos.has(key)) return 5;
  if (CRITERIOS.importantes.has(key)) return 3;
  return 1;
}
function classificarRegisto() {
  const avaliacoes = allChecks.map(([key,label]) => ({
    key,label,valor: form.elements[key]?.value || '',peso: pesoChecklist(key)
  }));
  if (avaliacoes.some(item => !item.valor)) {
    return { condicao:'PENDENTE', cor:'CINZENTO', avaliacao:'Inspecção incompleta. Não existe classificação de saída.' };
  }
  const anomalias = avaliacoes.filter(item => item.valor === 'NÃO OK');
  // N/A em equipamentos de segurança exige avaliação, não é aprovação automática.
  const semAplicabilidade = avaliacoes.filter(item => item.valor === 'N/A' && (
    CRITERIOS.impeditivos.has(item.key) || CRITERIOS.criticos.has(item.key) ||
    ['extintor','caixaPrimeirosSocorros','coleteReflector','triangulos'].includes(item.key)
  ));
  const base = avaliacoes.filter(item => item.valor !== 'N/A');
  const totalPesos = base.reduce((sum,item)=>sum+item.peso,0);
  const pesosAnomalias = anomalias.reduce((sum,item)=>sum+item.peso,0);
  const risco = totalPesos ? 100 * pesosAnomalias / totalPesos : 0;
  const impeditivas = anomalias.filter(item=>CRITERIOS.impeditivos.has(item.key));
  const criticas = anomalias.filter(item=>CRITERIOS.criticos.has(item.key));
  let nivel, cor, decisao;
  if (impeditivas.length || risco > 30) {
    nivel='INOPERACIONAL'; cor='VERMELHO';
    decisao='Não autorizar a saída; encaminhar para verificação técnica e imobilização quando aplicável.';
  } else if (criticas.length || risco > 15) {
    nivel='CRÍTICO'; cor='LARANJA';
    decisao='Não autorizar a saída até avaliação e resolução técnica.';
  } else if (semAplicabilidade.length || risco > 5) {
    nivel='ATENÇÃO'; cor='AMARELO';
    decisao='Saída condicionada a avaliação e autorização técnica.';
  } else if (anomalias.length) {
    nivel='OPERACIONAL'; cor='VERDE-CLARO';
    decisao='Anomalias ligeiras identificadas; registar acompanhamento e confirmar condições de saída.';
  } else {
    nivel='EXCELENTE'; cor='VERDE';
    decisao='Nenhuma anomalia assinalada; manter as verificações operacionais habituais.';
  }
  const explicacoes = [
    anomalias.length ? anomalias.length + ' anomalia(s): ' + anomalias.map(item=>item.label).join(', ') + '.' : 'Sem anomalias assinaladas.',
    'Índice preliminar de risco: ' + risco.toFixed(1).replace('.',',') + '%.',
    impeditivas.length ? 'Falha(s) impeditiva(s) de segurança: ' + impeditivas.map(item=>item.label).join(', ') + '.' : '',
    criticas.length ? 'Elemento(s) crítico(s): ' + criticas.map(item=>item.label).join(', ') + '.' : '',
    semAplicabilidade.length ? 'N/A em elemento(s) de segurança a confirmar: ' + semAplicabilidade.map(item=>item.label).join(', ') + '.' : '',
    decisao,
    'Classificação automática preliminar; não equivale a libertação técnica.'
  ].filter(Boolean);
  return {condicao: nivel + ' (' + cor + ')', nivel, cor, avaliacao: explicacoes.join(' ')};
}

function checklistResult() {
  const failed = allChecks.filter(([key]) => form.elements[key]?.value === 'NÃO OK').map(([, label]) => label);
  const answered = allChecks.filter(([key]) => form.elements[key]?.value).length;
  return { estado: answered === allChecks.length ? (failed.length ? 'NÃO APTO' : 'APTO') : 'PENDENTE', incidente: failed.join('; ') };
}

function updateResult() {
  // A avaliação e a classificação só são apresentadas DEPOIS de gravar.
  const box = document.querySelector('#resultBox');
  box.dataset.state = 'PENDENTE';
  document.querySelector('#estadoPreview').textContent = 'PENDENTE';
  document.querySelector('#incidentPreview').textContent = 'A classificação será apresentada depois do registo.';
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
  const classificacao = classificarRegisto();
  payload['Condição'] = classificacao.condicao;
  payload['Avaliação'] = classificacao.avaliacao;
  payload.estado = result.estado;
  payload.incidente = result.incidente;
  payload.registadoEm = new Date().toISOString();
  payload.origem = 'web-checklist-saida';

  if (!config.demoMode && !submissionEndpoint()) {
    refreshEndpointStatus();
    document.querySelector('#formHint').textContent =
      'O URL HTTP de envio está incompleto. Configure a ligação ao Power Automate no início da página.';
    endpointSection.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'A enviar...';
  try {
    if (!config.demoMode) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(submissionEndpoint(), {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) {
        const errorText = (await response.text().catch(() => '')).slice(0,300);
        console.error('Falha HTTP no fluxo:',response.status,errorText);
        throw new Error('O fluxo devolveu HTTP ' + response.status +
          '. Consulte o histórico do Power Automate e os mapeamentos do Excel.');
      }
    } else {
      const entries = JSON.parse(localStorage.getItem('sirChecklistSaidaDemo') || '[]');
      entries.push(payload);
      localStorage.setItem('sirChecklistSaidaDemo', JSON.stringify(entries));
    }
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector('#successMessage').textContent = config.demoMode ? 'Modo de demonstração: registo guardado neste dispositivo.' : 'Checklist enviado ao sistema.';
    const resultadoFinal = document.querySelector('#resultadoFinal');
    resultadoFinal.hidden = false;
    resultadoFinal.dataset.cor = classificacao.cor;
    document.querySelector('#condicaoFinal').textContent = classificacao.condicao;
    document.querySelector('#avaliacaoFinal').textContent = classificacao.avaliacao;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Erro na submissão do checklist:', error.name, error.message);
    document.querySelector('#formHint').textContent =
      error.name === 'AbortError' ? 'O fluxo não respondeu em 30 segundos. Confirme no Excel antes de reenviar para evitar duplicações.' :
      error instanceof TypeError ? 'Erro de rede ou CORS. Verifique o URL HTTP completo, o acesso público do gatilho e a ligação à Internet.' :
      'Não foi possível enviar: ' + error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Enviar checklist';
  }
});

document.querySelector('#newEntry').addEventListener('click', () => {
  form.reset(); setToday(); form.hidden = false; successPanel.hidden = true;
  document.querySelector('#bulkCheckFeedback').textContent = '';
  document.querySelector('#resultadoFinal').hidden = true;
  document.querySelector('#formHint').textContent = 'Confirme os dados antes de enviar.';
  updateProgress();
});

renderChecks('geralChecks', groups.geral);
renderChecks('mecanicaChecks', groups.mecanica);
renderChecks('pneusChecks', groups.pneus);
setToday();
loadMasterData();
updateProgress();
