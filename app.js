const config = window.CHECKLIST_CONFIG || {};
const form = document.querySelector('#checklistForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');
// O único endereço de submissão é o definido em config.js.
function submissionEndpoint() {
  return String(config.submissionUrl || '').trim();
}

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


// A manutenção é calculada a partir da última manutenção efectivamente
// confirmada na base de viaturas, nunca por múltiplos de 20.000 km do odómetro.
const INTERVALO_MANUTENCAO_KM = 20000;
const ALERTA_MANUTENCAO_KM = Number.isFinite(Number(config.maintenanceAlertKm))
  ? Math.max(0, Number(config.maintenanceAlertKm)) : 1000;
const manutencoesViaturas = new Map();
const kmManutencaoKeys = [
  'kmUltimaManutencaoPreventiva','KM_Ultima_Manutencao_Preventiva',
  'Km_Ultima_Manutencao_Preventiva','KM Última Manutenção Preventiva',
  'km_ultima_manutencao_preventiva','kmUltimaManutencao',
  'Km_Ultima_Manutencao','ultimaManutencaoKm'
];
function valorKmConfirmado(item) {
  if (!item || typeof item !== 'object') return null;
  for (const key of kmManutencaoKeys) {
    if (item[key] === null || item[key] === undefined || String(item[key]).trim() === '') continue;
    const raw = String(item[key]).trim().replace(/\s/g,'').replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(raw)) continue;
    const valor = Number(raw);
    if (Number.isFinite(valor) && valor >= 0) return valor;
  }
  return null;
}
function calcularManutencao() {
  const viatura = form.elements.viatura.value;
  const rawKm = form.elements.kmInicial.value;
  const kmActual = rawKm === '' ? null : Number(rawKm);
  const ultimoKm = manutencoesViaturas.get(viatura);
  if (!viatura || kmActual === null || !Number.isFinite(kmActual) || kmActual < 0) {
    return {estado:'SEM DADOS',detalhe:'Seleccione a viatura e preencha a quilometragem actual.'};
  }
  if (ultimoKm === undefined || ultimoKm === null) {
    return {estado:'SEM DADOS',detalhe:'Sem quilometragem da última manutenção preventiva confirmada para esta viatura. A oficina deve actualizar os dados mestre.'};
  }
  if (kmActual < ultimoKm) {
    return {estado:'VERIFICAR DADOS',detalhe:'O odómetro indicado é inferior ao da última manutenção preventiva registada. Verifique os dados antes de usar esta avaliação.'};
  }
  const proximoKm = ultimoKm + INTERVALO_MANUTENCAO_KM;
  const faltaKm = proximoKm - kmActual;
  const formato = valor => new Intl.NumberFormat('pt-MZ',{maximumFractionDigits:0}).format(valor);
  const detalhe = 'Última preventiva: ' + formato(ultimoKm) +
    ' km. Próxima prevista: ' + formato(proximoKm) +
    ' km. ' + (faltaKm > 0 ? 'Faltam ' + formato(faltaKm) + ' km.' :
    'Prazo ultrapassado em ' + formato(Math.abs(faltaKm)) + ' km.');
  const estado = faltaKm <= 0 ? 'VENCIDA' :
    faltaKm <= ALERTA_MANUTENCAO_KM ? 'PRÓXIMA' : 'EM DIA';
  return {estado, detalhe};
}
function actualizarManutencao() {
  const resultado = calcularManutencao();
  document.querySelector('#maintenanceStatus').textContent = resultado.estado;
  document.querySelector('#maintenanceStatus').dataset.status = resultado.estado;
  document.querySelector('#maintenanceInfo').textContent = resultado.detalhe;
}
form.elements.viatura.addEventListener('change', actualizarManutencao);
form.elements.kmInicial.addEventListener('input', actualizarManutencao);

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
    manutencoesViaturas.clear();
    for (const item of (Array.isArray(data.viaturas) ? data.viaturas : [])) {
      if (!item || typeof item !== 'object') continue;
      const id = displayValue(item,'viaturas');
      const ultimoKm = valorKmConfirmado(item);
      if (id && ultimoKm !== null) manutencoesViaturas.set(id,ultimoKm);
    }
    fillSelect('viaturas', data.viaturas);
    actualizarManutencao();
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
  // A coluna Incidente regista TODOS os itens não conformes. A Avaliação explica
  // tecnicamente a quantidade, a consequência possível e o encaminhamento.
  const familias = [
    { nome:'Travagem e segurança activa',
      itens:['travoes','balatas','calcos','nivelOleoTravoes','sistemaAbs'],
      descricao:'Respostas desfavoráveis nestes componentes podem comprometer a eficácia da travagem, a estabilidade ou o controlo da viatura. É indispensável inspecção técnica antes da circulação.' },
    { nome:'Pneus e contacto com o pavimento',
      itens:['estadoPneus','pneuFrentePassageiro','pneuFrenteMotorista','pneuTraseiroPassageiro','pneuTraseiroMotorista'],
      descricao:'As não conformidades podem prejudicar aderência, estabilidade e capacidade de travagem, exigindo verificação do estado, desgaste e pressão dos pneus.' },
    { nome:'Direcção, transmissão e mecânica',
      itens:['nivelOleoDireccao','rolamentos','caixaVelocidades','escape'],
      descricao:'As anomalias assinaladas podem afectar o controlo, a transmissão de potência ou a fiabilidade mecânica. A natureza e a gravidade da falha devem ser confirmadas pela oficina.' },
    { nome:'Lubrificação e arrefecimento',
      itens:['fugasOleo','nivelAguaRadiador'],
      descricao:'Uma fuga de óleo ou nível inadequado de líquido de arrefecimento pode provocar perda de fluidos, aquecimento excessivo ou danos mecânicos; é necessária verificação da origem e extensão.' },
    { nome:'Visibilidade, iluminação e sinalização',
      itens:['farol','refletores','luzesTravao','luzesRetaguarda','luzesPresenca','luzesMinimos','luzesMedios','luzesMaximos','luzesNevoeiro','buzina','pirilampos','limpaParaBrisas','retrovisoresExternos','espelhoInterior','vidros'],
      descricao:'Estas deficiências podem reduzir a visibilidade do condutor ou a percepção da viatura por terceiros, sobretudo em condições nocturnas ou meteorológicas adversas.' },
    { nome:'Protecção de passageiros e equipamentos de emergência',
      itens:['portasMacanetas','cintosSeguranca','caixaPrimeirosSocorros','extintor','coleteReflector','triangulos'],
      descricao:'A ausência ou deficiência destes elementos pode comprometer a protecção dos ocupantes, o acesso seguro ou a resposta a emergências; deve ser verificada a sua conformidade.' },
    { nome:'Conservação, conforto e operação',
      itens:['limpeza','chaparia','nivelLiquidoVidros','bateria','arCondicionado','placas','tampaCombustivel'],
      descricao:'Estas anomalias podem afectar o conforto, a apresentação, a fiabilidade ou requisitos operacionais, consoante a sua natureza e extensão.' }
  ];
  const gruposAfectados = familias.map(familia => {
    const afectados = anomalias.filter(item => familia.itens.includes(item.key));
    return afectados.length ? { ...familia, quantidade:afectados.length } : null;
  }).filter(Boolean);
  const conhecidos = new Set(familias.flatMap(f => f.itens));
  const outros = anomalias.filter(item => !conhecidos.has(item.key));
  const aplicaveis = avaliacoes.filter(item => item.valor !== 'N/A').length;
  const linhas = [
    'RESUMO DA INSPECÇÃO: ' + anomalias.length + ' anomalia(s) identificada(s) em ' +
      aplicaveis + ' verificações aplicáveis (' + avaliacoes.length + ' itens no formulário).',
    'FUNDAMENTAÇÃO TÉCNICA: ' +
      (anomalias.length
        ? 'A classificação ' + nivel + ' resulta da combinação entre a criticidade dos componentes assinalados como não conformes e o índice ponderado de anomalias de ' +
          risco.toFixed(1).replace('.', ',') + '%. Foram identificadas ' +
          impeditivas.length + ' não conformidade(s) em elementos de segurança impeditivos e ' +
          criticas.length + ' em elementos críticos. As respostas do motorista indicam possíveis riscos, mas não constituem diagnóstico técnico definitivo.'
        : 'Não foram registadas não conformidades nas verificações aplicáveis. O índice ponderado de anomalias é 0%. A ausência de anomalias assinaladas não substitui os procedimentos de verificação e libertação da viatura.'),
    ...gruposAfectados.map(grupo => grupo.nome.toUpperCase() + ' (' + grupo.quantidade +
      '): ' + grupo.descricao),
    outros.length ? 'OUTROS ELEMENTOS (' + outros.length +
      '): Verificar tecnicamente as não conformidades adicionais assinaladas no campo Incidente.' : '',
    semAplicabilidade.length ? 'VALIDAÇÃO PENDENTE: ' + semAplicabilidade.length +
      ' resposta(s) N/A em elementos de segurança ou emergência carecem de confirmação da aplicabilidade.' : '',
    'DECISÃO RECOMENDADA: ' + decisao,
    anomalias.length || semAplicabilidade.length
      ? 'ENCAMINHAMENTO: Comunicar o registo à Supervisão de Operações e à Oficina. A equipa técnica deve confirmar os defeitos, definir medidas correctivas e documentar a autorização ou a proibição de circulação.'
      : 'ENCAMINHAMENTO: Prosseguir com os procedimentos normais de controlo e autorização de saída.',
    'NOTA: Classificação preliminar automática; não equivale a diagnóstico, aprovação técnica ou autorização de circulação.'
  ].filter(Boolean);
  return {condicao: nivel + ' (' + cor + ')', nivel, cor, avaliacao: linhas.join('\n')};
}

function checklistResult() {
  const failed = allChecks.filter(([key]) => form.elements[key]?.value === 'NÃO OK').map(([, label]) => label);
  const answered = allChecks.filter(([key]) => form.elements[key]?.value).length;
  return { estado: answered === allChecks.length ? (failed.length ? 'NÃO APTO' : 'APTO') : 'PENDENTE', incidente: failed.length ? failed.join('; ') : 'Sem anomalias identificadas' };
}

function updateResult() {
  // Durante o preenchimento, mostrar as anomalias, mas não antecipar a condição.
  const box = document.querySelector('#resultBox');
  const resultado = checklistResult();
  const anomalias = allChecks.filter(([key]) => form.elements[key]?.value === 'NÃO OK');
  const respondidas = allChecks.filter(([key]) => Boolean(form.elements[key]?.value)).length;
  box.dataset.state = 'PENDENTE';
  document.querySelector('#estadoPreview').textContent = 'PENDENTE';
  document.querySelector('#incidentPreview').textContent = anomalias.length
    ? 'Anomalias identificadas (' + anomalias.length + '): ' + anomalias.map(([,label]) => label).join('; ') +
      '. A condição e a avaliação técnica serão apresentadas depois do registo.'
    : respondidas === allChecks.length
      ? 'Nenhuma anomalia identificada. A condição e a avaliação técnica serão apresentadas depois do registo.'
      : 'Nenhuma anomalia identificada até ao momento (' + respondidas + '/' + allChecks.length +
        ' verificações respondidas). A condição e a avaliação técnica serão apresentadas depois do registo.';
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
  // O campo "utilizador" é enviado pelo FormData para a coluna Utilizador.
  const manutencao = calcularManutencao();
  payload['Manutenção Preventiva'] = manutencao.estado;
  payload.estado = result.estado;
  payload.incidente = result.incidente;
  payload.registadoEm = new Date().toISOString();
  payload.origem = 'web-checklist-saida';

  if (!config.demoMode && !submissionEndpoint()) {
    document.querySelector('#formHint').textContent =
      'Ligação não configurada no ficheiro config.js. Contacte o administrador.';
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
  actualizarManutencao();
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
actualizarManutencao();
updateProgress();
