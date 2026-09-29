/* ===== Banner de Destaque — partilhado entre a Agenda e o Dashboard =====
 * Lê uma lista de eventos (agenda-geral) e seleciona os que merecem
 * destaque, sem exigir marcação manual para o essencial:
 *
 *   - "hoje"    -> qualquer evento cuja data seja hoje, qualquer categoria
 *   - "viatura" -> eventos de categoria "viatura" dentro da janela de aviso
 *                  (hoje: janela fixa de 30 dias; quando existir a "ficha
 *                  da viatura" com o motor de prazos legais IPO/IUC, esta
 *                  janela passa a vir de lá — ver calcularJanelaViatura)
 *   - "manual"  -> qualquer evento com destaque:true, dentro de uma janela
 *                  de antecedência configurável (JANELA_MANUAL)
 *
 * Usa-se em qualquer página que já tenha carregado a lista `eventos`
 * (array de docs de agenda-geral, cada um com {id, nome, data, cat, ...}):
 *
 *   MiraBannerDestaque.montarBannerDestaque('destaque-banner', eventos);
 *   MiraBannerDestaque.montarBannerDestaque('destaque-banner-dash', eventos, {compacto:true});
 */
(function (global) {
  var JANELA_VIATURA_PADRAO = 30; // dias — placeholder até existir o motor de prazos legais
  var JANELA_MANUAL = 14;         // dias de antecedência para destaques marcados manualmente
  var ROTACAO_MS = 4500;

  var ICONE_MOTIVO = { hoje: '📌', viatura: '🚗', manual: '⭐' };

  function diasAte(dataStr, hoje) {
    var d = new Date(dataStr + 'T00:00:00');
    return Math.round((d - hoje) / 86400000);
  }

  function calcularJanelaViatura(evento) {
    // Ponto único de extensão: quando a ficha da viatura calcular a
    // inspeção/selo por matrícula, esta função passa a devolver a janela
    // certa por evento (3 meses p/ inspeção, mês da matrícula p/ selo).
    return JANELA_VIATURA_PADRAO;
  }

  function recolherDestaques(eventos, opts) {
    opts = opts || {};
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var hojeStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    var itens = [];

    (eventos || []).forEach(function (e) {
      if (!e || !e.data) return;
      var dias = diasAte(e.data, hoje);
      var motivo = null;

      if (e.data === hojeStr) {
        motivo = 'hoje';
      } else if (e.cat === 'viatura' && dias <= calcularJanelaViatura(e)) {
        motivo = 'viatura';
      } else if (e.destaque && dias <= JANELA_MANUAL) {
        motivo = 'manual';
      }

      if (motivo) itens.push({ evento: e, dias: dias, motivo: motivo });
    });

    itens.sort(function (a, b) { return a.dias - b.dias; });
    return itens;
  }

  function formatarPrazo(dias) {
    if (dias < 0) return 'Vencido há ' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' dia' : ' dias');
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Amanhã';
    return 'Em ' + dias + ' dias';
  }

  function corPrazo(dias) {
    if (dias <= 0) return '#e85555';
    if (dias <= 7) return '#e8a855';
    return '#c9a96e';
  }

  function montarBannerDestaque(containerId, eventos, opts) {
    opts = opts || {};
    var el = document.getElementById(containerId);
    if (!el) return;

    if (el._destaqueTimer) { clearInterval(el._destaqueTimer); el._destaqueTimer = null; }

    var itens = recolherDestaques(eventos, opts);
    if (!itens.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = 'block';
    var idx = 0;

    el.onclick = function () {
      var item = itens[idx];
      if (typeof opts.onItemClick === 'function') { opts.onItemClick(item.evento.id, item.evento); return; }
      window.location.href = opts.linkAgenda || 'apps/agenda/index.html';
    };

    function render() {
      var item = itens[idx];
      var e = item.evento;
      var icone = ICONE_MOTIVO[item.motivo] || '📌';
      var cor = corPrazo(item.dias);
      var nomeEscapado = String(e.nome || '');
      var respTxt = e.resp ? ' · ' + e.resp : '';
      el.innerHTML =
        '<div class="destaque-conteudo">' +
          '<div class="destaque-msg">' +
            '<span class="destaque-icone">' + icone + '</span>' +
            '<span class="destaque-nome">' + nomeEscapado + respTxt + '</span>' +
          '</div>' +
          '<span class="destaque-prazo" style="color:' + cor + '">' + formatarPrazo(item.dias) + '</span>' +
        '</div>' +
        (itens.length > 1 ? '<div class="destaque-pontos">' + itens.map(function (_, i) {
          return '<span class="destaque-ponto' + (i === idx ? ' ativo' : '') + '"></span>';
        }).join('') + '</div>' : '');
    }

    render();
    if (itens.length > 1) {
      el._destaqueTimer = setInterval(function () {
        idx = (idx + 1) % itens.length;
        render();
      }, ROTACAO_MS);
    }
  }

  global.MiraBannerDestaque = {
    montarBannerDestaque: montarBannerDestaque,
    recolherDestaques: recolherDestaques
  };
})(window);
