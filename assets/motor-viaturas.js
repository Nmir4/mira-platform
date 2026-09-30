/* ===== Motor de prazos legais de viaturas (IPO + IUC/Selo) =====
 * Regras aplicadas (Portugal), conforme apuradas:
 *
 *  - IPO (Inspeção Periódica Obrigatória), por idade da viatura (anos
 *    desde a 1ª matrícula):
 *      ligeiro-passageiros: 4, 6, 8, depois anual (9, 10, 11...).
 *      ligeiro-mercadorias: 2, depois anual (3, 4, 5...).
 *      outra categoria: periodicidade não calculada automaticamente
 *        (varia consoante o tipo de veículo) — gerir manualmente na
 *        Agenda (categoria "Viatura" + repetição).
 *    A inspeção pode ser feita até 3 meses antes da data-limite — é essa
 *    a janela de aviso usada pelo banner de destaque.
 *
 *  - IUC / Selo: anual, a pagar durante o mês civil do aniversário da
 *    matrícula (do dia 1 ao último dia desse mês), independentemente da
 *    categoria do veículo.
 *
 *    ATENÇÃO — viaturas IMPORTADAS: o mês que conta para o IUC é o do
 *    registo/matrícula em Portugal (matrícula nacional, campo da DUA/
 *    livrete), não o mês da 1ª matrícula no país de origem (o que está
 *    gravado na chapa/faixa amarela pode ser um mês diferente). Isto está
 *    confirmado pelo artigo 4º do Código do IUC ("...com exceção do ano
 *    da matrícula ou registo do veículo em território nacional...") e é
 *    prática corrente confirmada pela AT: uma viatura importada mantém a
 *    data da 1ª matrícula estrangeira para efeitos de idade/categoria e
 *    inspeções, mas o ciclo do selo segue a data de matrícula portuguesa.
 *    Por isso a ficha tem um campo opcional "matriculaNacionalPT" — só
 *    preenchido quando a viatura foi importada — que manda no mês do
 *    selo sem alterar o cálculo da inspeção (que continua a usar sempre
 *    dataMatricula).
 *
 * Cada viatura (coleção Firestore "viaturas-frota") guarda:
 *   matricula, categoria, dataMatricula,
 *   matriculaNacionalPT (opcional — data de registo em Portugal, só para
 *     viaturas importadas; se ausente, assume-se que dataMatricula já é
 *     a matrícula portuguesa),
 *   proximaInspecao (data, YYYY-MM-DD, ou null se categoria sem cálculo),
 *   seloConfirmadoAno (último ano civil cujo selo foi confirmado pago)
 *
 * IMPORTANTE: proximaInspecao é a data-limite ATUAL, guardada diretamente
 * — não um índice de ciclo contado desde a matrícula. Isto é essencial
 * para viaturas que já tinham uma vida (e inspeções) antes de entrarem
 * neste sistema: ao criar a ficha, se já se souber a próxima inspeção
 * real, essa data é usada tal e qual; só quando não se sabe é que se
 * calcula a partir do zero (1ª inspeção legal a contar da matrícula) —
 * o que só faz sentido para uma viatura mesmo a estrear. Cada confirmação
 * avança a data para a idade seguinte da tabela, a partir da idade em
 * que a viatura estava nessa inspeção (não de uma contagem de ciclos).
 *
 * Este módulo é independente do Firestore: só calcula datas. Quem o usa
 * decide o que escrever na agenda-geral (ver construirEventosAgenda).
 */
(function (global) {

  // Idade (em anos completos) a que a PRÓXIMA inspeção é devida, dado que
  // a última confirmada (ou a situação de partida) foi à idade "idade".
  function proximaIdadeInspecao(categoria, idade) {
    if (categoria === 'ligeiro-passageiros') {
      if (idade < 4) return 4;
      if (idade < 8) return idade + 2; // 4->6, 6->8
      return idade + 1; // anual a partir dos 8
    }
    if (categoria === 'ligeiro-mercadorias') {
      if (idade < 2) return 2;
      return idade + 1; // anual a partir dos 2
    }
    return null; // sem periodicidade automática para esta categoria
  }

  function somarAnosAData(dataStr, anos) {
    var p = dataStr.split('-').map(Number);
    var ano = p[0], mes = p[1], dia = p[2];
    return (ano + anos) + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  }

  // Idade (anos inteiros) da viatura numa certa data, assumindo que a
  // data-limite cai sempre no dia/mês da matrícula (como a lei define).
  function idadeNaData(dataMatricula, dataAlvo) {
    return new Date(dataAlvo).getFullYear() - new Date(dataMatricula).getFullYear();
  }

  // Calcula a próxima inspeção partindo do zero (viatura a estrear no
  // sistema, sem qualquer inspeção conhecida) — 1º ciclo legal a contar
  // da matrícula.
  function calcularPrimeiraInspecao(viatura) {
    var idade = proximaIdadeInspecao(viatura.categoria, 0);
    if (idade === null) return null;
    return somarAnosAData(viatura.dataMatricula, idade);
  }

  // A próxima inspeção é sempre a que está guardada em viatura.proximaInspecao.
  // Só recalcula do zero se esse campo não existir (ficha antiga/incompleta).
  function calcularProximaInspecao(viatura) {
    if (!viatura || !viatura.dataMatricula) return null;
    if (viatura.proximaInspecao) return { data: viatura.proximaInspecao };
    var data = calcularPrimeiraInspecao(viatura);
    return data ? { data: data } : null;
  }

  // Ao confirmar uma inspeção feita na data-limite atual, avança para a
  // idade seguinte da tabela — a partir da idade real em que a viatura
  // estava, não de uma contagem de ciclos desde a matrícula.
  function avancarInspecao(viatura) {
    var dataAtual = viatura.proximaInspecao || calcularPrimeiraInspecao(viatura);
    if (!dataAtual) return null;
    var idadeConfirmada = idadeNaData(viatura.dataMatricula, dataAtual);
    var proximaIdade = proximaIdadeInspecao(viatura.categoria, idadeConfirmada);
    if (proximaIdade === null) return null;
    return somarAnosAData(viatura.dataMatricula, proximaIdade);
  }

  function ultimoDiaDoMes(ano, mes1a12) {
    return new Date(ano, mes1a12, 0).getDate();
  }

  function calcularProximoSelo(viatura) {
    if (!viatura || !viatura.dataMatricula) return null;
    // Importada -> usa o mês da matrícula/registo em Portugal, não o da
    // 1ª matrícula no país de origem (ver nota no topo do ficheiro).
    var dataReferenciaSelo = viatura.matriculaNacionalPT || viatura.dataMatricula;
    var mesMatricula = parseInt(dataReferenciaSelo.split('-')[1], 10);
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var anoAtual = hoje.getFullYear();
    var mesAtual = hoje.getMonth() + 1;
    // Ciclo corrente: o ano civil cujo mes da matricula ja chegou ou esta a decorrer.
    var cicloCorrente = (mesAtual > mesMatricula) ? anoAtual + 1 : anoAtual;
    var ultimoConfirmado = viatura.seloConfirmadoAno || (cicloCorrente - 1);
    var anoAlvo = Math.max(cicloCorrente, ultimoConfirmado + 1);
    var dia = ultimoDiaDoMes(anoAlvo, mesMatricula);
    return { data: anoAlvo + '-' + String(mesMatricula).padStart(2, '0') + '-' + String(dia).padStart(2, '0'), ano: anoAlvo };
  }

  // Deteta situações que costumam ser erro humano (ex.: cliques a dobrar
  // em "Selo pago"/"Inspeção feita", ou campos trocados) — não impede
  // nada, só avisa, para serem revistas com calma na ficha.
  function detectarAnomalias(viatura) {
    var avisos = [];
    if (!viatura || !viatura.dataMatricula) return avisos;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var hojeStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

    if (viatura.dataMatricula > hojeStr) {
      avisos.push('A 1ª matrícula está registada no futuro (' + viatura.dataMatricula + ').');
    }

    if (viatura.matriculaNacionalPT && viatura.matriculaNacionalPT < viatura.dataMatricula) {
      avisos.push('A data de registo em Portugal (' + viatura.matriculaNacionalPT + ') é anterior à 1ª matrícula (' + viatura.dataMatricula + ') — parecem trocadas.');
    }

    if (viatura.seloConfirmadoAno) {
      var selo = calcularProximoSelo(viatura);
      var mesRef = parseInt((viatura.matriculaNacionalPT || viatura.dataMatricula).split('-')[1], 10);
      var anoAtual = hoje.getFullYear();
      var mesAtual = hoje.getMonth() + 1;
      var cicloCorrente = (mesAtual > mesRef) ? anoAtual + 1 : anoAtual;
      if (viatura.seloConfirmadoAno - cicloCorrente > 2) {
        avisos.push('Selo confirmado até ' + viatura.seloConfirmadoAno + ', ' + (viatura.seloConfirmadoAno - cicloCorrente) + ' anos à frente do esperado — confirma se não houve confirmações a mais por engano (ver Histórico).');
      }
    }

    if (viatura.proximaInspecao) {
      var dias = Math.round((new Date(viatura.proximaInspecao + 'T00:00:00') - hoje) / 86400000);
      if (dias < -180) {
        avisos.push('Próxima inspeção vencida há mais de 6 meses (' + viatura.proximaInspecao + ') — confirma se já foi feita e a ficha ficou por atualizar, ou se a data está errada.');
      }
    }

    return avisos;
  }

  var LABEL_CATEGORIA = {
    'ligeiro-passageiros': 'Ligeiro de passageiros',
    'ligeiro-mercadorias': 'Ligeiro de mercadorias',
    'outro': 'Outra categoria'
  };

  function idMatricula(matricula) {
    return String(matricula || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // Constrói os eventos de agenda-geral (inspeção + selo) a escrever para
  // esta viatura. Devolve { inspecao: {id,doc}|null, selo: {id,doc} }.
  // "inspecao" vem null quando a categoria não tem periodicidade calculável
  // — quem chamar deve nesse caso apagar um eventual VEIC-INSP-* antigo.
  function construirEventosAgenda(viatura) {
    var mid = idMatricula(viatura.matricula);
    var agora = new Date().toISOString();
    var resultado = { inspecao: null, selo: null };

    var insp = calcularProximaInspecao(viatura);
    if (insp) {
      resultado.inspecao = {
        id: 'VEIC-INSP-' + mid,
        doc: {
          nome: 'Inspeção · ' + viatura.matricula,
          data: insp.data,
          hora: '',
          cat: 'viatura',
          local: '',
          resp: '',
          notas: 'Inspeção periódica obrigatória — pode ser feita até 3 meses antes desta data.',
          subtipoViatura: 'inspecao',
          origemViatura: mid,
          criadoEm: agora
        }
      };
    }

    var selo = calcularProximoSelo(viatura);
    if (selo) {
      resultado.selo = {
        id: 'VEIC-SELO-' + mid,
        doc: {
          nome: 'Selo (IUC) · ' + viatura.matricula,
          data: selo.data,
          hora: '',
          cat: 'viatura',
          local: '',
          resp: '',
          notas: 'Imposto Único de Circulação — ano ' + selo.ano + '. Pode ser pago em qualquer dia do mês.',
          subtipoViatura: 'selo',
          origemViatura: mid,
          criadoEm: agora
        }
      };
    }

    return resultado;
  }

  global.MotorViaturas = {
    idMatricula: idMatricula,
    labelCategoria: function (cat) { return LABEL_CATEGORIA[cat] || cat || 'Outra categoria'; },
    calcularPrimeiraInspecao: calcularPrimeiraInspecao,
    calcularProximaInspecao: calcularProximaInspecao,
    avancarInspecao: avancarInspecao,
    calcularProximoSelo: calcularProximoSelo,
    detectarAnomalias: detectarAnomalias,
    construirEventosAgenda: construirEventosAgenda
  };
})(window);
