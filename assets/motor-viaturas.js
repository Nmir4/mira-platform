/* ===== Motor de prazos legais de viaturas (IPO + IUC/Selo) =====
 * Regras aplicadas (Portugal), conforme apuradas:
 *
 *  - IPO (Inspeção Periódica Obrigatória):
 *      ligeiro-passageiros: 1ª inspeção aos 4 anos da 1ª matrícula,
 *        depois de 2 em 2 anos até aos 8 anos (i.e. aos 6 e aos 8 anos),
 *        e anual a partir dos 8 anos.
 *      ligeiro-mercadorias: 1ª inspeção aos 2 anos da 1ª matrícula,
 *        depois anual.
 *      outra categoria: periodicidade não calculada automaticamente
 *        (varia consoante o tipo de veículo) — gerir manualmente na
 *        Agenda (categoria "Viatura" + repetição).
 *    A inspeção pode ser feita até 3 meses antes da data-limite — é essa
 *    a janela de aviso usada pelo banner de destaque.
 *
 *  - IUC / Selo: anual, a pagar durante o mês civil do aniversário da
 *    1ª matrícula (do dia 1 ao último dia desse mês), independentemente
 *    da categoria do veículo.
 *
 * Cada viatura (coleção Firestore "viaturas-frota") guarda:
 *   matricula, categoria, dataMatricula,
 *   inspecoesConfirmadas (nº de ciclos de inspeção já confirmados),
 *   seloConfirmadoAno (último ano civil cujo selo foi confirmado pago)
 *
 * Este módulo é independente do Firestore: só calcula datas. Quem o usa
 * decide o que escrever na agenda-geral (ver construirEventosAgenda).
 */
(function (global) {

  function anosDoCiclo(categoria, indice) {
    if (categoria === 'ligeiro-passageiros') {
      if (indice === 0) return 4;
      if (indice === 1) return 6;
      if (indice === 2) return 8;
      return indice + 6; // 8,9,10... a partir do 4º ciclo (indice>=3 -> 9,10,...)
    }
    if (categoria === 'ligeiro-mercadorias') {
      return indice + 2; // 2,3,4,5...
    }
    return null; // sem periodicidade automática para esta categoria
  }

  function somarAnosAData(dataStr, anos) {
    var p = dataStr.split('-').map(Number);
    var ano = p[0], mes = p[1], dia = p[2];
    return (ano + anos) + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  }

  function calcularProximaInspecao(viatura) {
    if (!viatura || !viatura.dataMatricula) return null;
    var indice = viatura.inspecoesConfirmadas || 0;
    var anos = anosDoCiclo(viatura.categoria, indice);
    if (anos === null) return null;
    return { data: somarAnosAData(viatura.dataMatricula, anos), ciclo: indice + 1 };
  }

  function ultimoDiaDoMes(ano, mes1a12) {
    return new Date(ano, mes1a12, 0).getDate();
  }

  function calcularProximoSelo(viatura) {
    if (!viatura || !viatura.dataMatricula) return null;
    var mesMatricula = parseInt(viatura.dataMatricula.split('-')[1], 10);
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
          resp: viatura.matricula,
          notas: 'Inspeção periódica obrigatória (ciclo nº' + insp.ciclo + ') — pode ser feita até 3 meses antes desta data.',
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
          resp: viatura.matricula,
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
    calcularProximaInspecao: calcularProximaInspecao,
    calcularProximoSelo: calcularProximoSelo,
    construirEventosAgenda: construirEventosAgenda
  };
})(window);
