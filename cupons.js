window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};
const obterDados = window.obterDados;
const salvarDados = window.salvarDados;

let todosCuponsAgrupados = [];
let cupomSelecionadoAtual = null;

document.addEventListener("DOMContentLoaded", carregarEAgruparCupons);
document.addEventListener("dadosAtualizados", carregarEAgruparCupons);
document.addEventListener("bancoPronto", carregarEAgruparCupons);
if (window.isBancoPronto) carregarEAgruparCupons();

function converterDataISOparaBR(dataIso) {
    if (!dataIso) return "--/--/----";
    if (dataIso.includes("/")) return dataIso;
    const p = dataIso.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dataIso;
}

function carregarEAgruparCupons() {
    const movimentacoes = obterDados("movimentacoes") || {};
    const mapaCupons = {};
    const datas = Object.keys(movimentacoes).sort();

    datas.forEach(dia => {
        const lista = movimentacoes[dia] || [];
        let contadorDia = 1;
        const numPedidoMap = {};

        lista.forEach(venda => {
            if (!venda.idCupom) return;

            if (!numPedidoMap[venda.idCupom]) {
                numPedidoMap[venda.idCupom] = venda.numeroPedido
                    ? String(venda.numeroPedido).padStart(2, '0')
                    : String(contadorDia++).padStart(2, '0');
            }

            const id = venda.idCupom;
            if (!mapaCupons[id]) {
                mapaCupons[id] = {
                    idCupom: id,
                    numeroPedido: venda.numeroPedido || null,
                    numeroPedidoFormatado: numPedidoMap[id],
                    data: venda.data || dia,
                    hora: venda.hora || "--:--",
                    operador: venda.usuario || "Operador",
                    formaPagamento: venda.formaPagamento || "Dinheiro",
                    cliente: venda.cliente || "",       
                    observacao: venda.observacao || "", 
                    status: "venda",
                    itens: [],
                    total: 0
                };
            }

            const cp = mapaCupons[id];
            if (venda.tipoMovimento === 'cancelamento_total' || venda.tipoMovimento === 'cancelado') cp.status = 'cancelado';
            else if (venda.tipoMovimento === 'devolucao') cp.status = 'devolucao';
            else if (venda.tipoMovimento === 'descarte') cp.status = 'descarte';

            if (venda.tipoMovimento === 'venda' || (parseFloat(venda.quantidade) || 0) > 0) {
                cp.itens.push({
                    codigo: venda.codigo,
                    nome: venda.produto,
                    quantidade: parseFloat(venda.quantidade) || 0,
                    valor: parseFloat(venda.valor) || 0
                });
            }
        });
    });

    Object.values(mapaCupons).forEach(cp => {
        if (cp.status === 'cancelado') { cp.total = 0; return; }
        let s = 0;
        cp.itens.forEach(it => { s += it.valor * it.quantidade; });
        cp.total = s;
    });

    const arr = Object.values(mapaCupons);
    arr.sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data);
        return parseInt(b.numeroPedidoFormatado) - parseInt(a.numeroPedidoFormatado);
    });

    todosCuponsAgrupados = arr.slice(0, 200);
    renderizarListaCupons(todosCuponsAgrupados);

    if (cupomSelecionadoAtual) {
        const atual = todosCuponsAgrupados.find(c => c.idCupom === cupomSelecionadoAtual.idCupom);
        if (atual) exibirDetalhesCupom(atual);
    }
}

function renderizarListaCupons(lista) {
    const container = document.getElementById("container-lista-cupons");
    if (!container) return;
    container.innerHTML = "";

    if (!lista.length) {
        container.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: #7f8c8d;">
                <h1 style="font-size: 40px; margin: 0; margin-bottom: 10px;">📭</h1>
                <h3 style="margin: 0;">Nenhum pedido encontrado</h3>
                <p>Tente buscar por outro número ou data.</p>
            </div>`;
        return;
    }

    let dataHeaderAtual = "";
    lista.forEach(cupom => {
        const dataBR = converterDataISOparaBR(cupom.data);
        if (dataBR !== dataHeaderAtual) {
            const h = document.createElement("div");
            h.style.cssText = "grid-column:1/-1; font-size:15px; font-weight:800; color:#34495e; margin-top:20px; padding-bottom:8px; border-bottom:2px solid #bdc3c7; display: flex; align-items: center; gap: 8px;";
            h.innerHTML = `📅 Vendas de ${dataBR}`;
            container.appendChild(h);
            dataHeaderAtual = dataBR;
        }

        const isCancelado = cupom.status === "cancelado";
        const div = document.createElement("div");
        div.className = "card-cupom" + (isCancelado ? " cancelado" : "");

        const badgeHTML = isCancelado ? `<span class='badge badge-cancel'>❌ Cancelado</span>` : `<span class='badge badge-ok'>✅ Concluído</span>`;
        const corValor = isCancelado ? "#7f8c8d" : "#27ae60";
        const exibirTotal = isCancelado ? "<del>R$ " + cupom.itens.reduce((s, i) => s + (i.valor * i.quantidade), 0).toFixed(2) + "</del>" : "R$ " + cupom.total.toFixed(2);
        
        const txtCliente = cupom.cliente ? `<p class="card-info-row">👤 ${cupom.cliente}</p>` : `<p class="card-info-row">👤 Balcão</p>`;

        div.innerHTML = `
            <div class="card-header-row">
                <h4>📦 #${cupom.numeroPedidoFormatado}</h4>
                ${badgeHTML}
            </div>
            ${txtCliente}
            <p class="card-info-row">🕒 ${cupom.hora} &nbsp;|&nbsp; 💳 ${cupom.formaPagamento}</p>
            <p class="card-info-row">👨‍💻 Op: ${cupom.operador}</p>
            <div class="card-total" style="color: ${corValor};">${exibirTotal}</div>
        `;

        div.onclick = () => exibirDetalhesCupom(cupom);
        container.appendChild(div);
    });
}

function filtrarCupons() {
    const txt = (document.getElementById("inputBuscarCupom").value || "").trim().toUpperCase();
    const dt  = document.getElementById("inputFiltrarData").value;

    const filtrados = todosCuponsAgrupados.filter(c => {
        let okT = true, okD = true;
        if (txt) {
            okT = c.idCupom.toUpperCase().includes(txt) ||
                  c.numeroPedidoFormatado.includes(txt) ||
                  (c.cliente && c.cliente.toUpperCase().includes(txt)); 
        }
        if (dt) okD = (c.data === dt);
        return okT && okD;
    });

    renderizarListaCupons(filtrados);
    if (filtrados.length === 1) exibirDetalhesCupom(filtrados[0]);
}

function limparBuscaCupom() {
    document.getElementById("inputBuscarCupom").value = "";
    document.getElementById("inputFiltrarData").value = "";
    renderizarListaCupons(todosCuponsAgrupados);
    
    document.getElementById("resultado-cupom-content").innerHTML = `
        <div style='text-align:center; color:#7f8c8d; background:#fff; padding:40px 20px; border-radius:12px; border:2px dashed #bdc3c7; width: 100%;'>
            <h1 style="font-size: 40px; margin: 0; margin-bottom: 10px;">🖱️</h1>
            <h3 style="margin: 0; color: #34495e;">Nenhum cupom selecionado</h3>
            <p style="font-size: 14px;">Clique em um pedido na lista ao lado para visualizar os detalhes, imprimir uma segunda via ou realizar o cancelamento.</p>
        </div>`;
    cupomSelecionadoAtual = null;
}

function montarConteudoCupom(cupom) {
    const configLoja = obterDados("configLoja") || { nome: "Nome da Loja", cnpj: "00.000.000/0000-00" };
    
    // VERIFICA SE DEVE MOSTRAR O NÚMERO DO PEDIDO
    const configEmp = obterDados("configEmpresa") || {};
    const mostrarNumPedido = configEmp.usarNumeroPedido !== false;
    
    const dataBR = converterDataISOparaBR(cupom.data);
    const dataHora = dataBR + " " + (cupom.hora || "");
    const operador = cupom.operador || "Operador";
    const cupomIdText = cupom.idCupom ? cupom.idCupom.split('-')[1] : "000000";

    let numPedidoFormatado = cupom.numeroPedidoFormatado || "00";
    if (cupom.numeroPedido) {
        numPedidoFormatado = cupom.numeroPedido < 10
            ? "0" + cupom.numeroPedido
            : String(cupom.numeroPedido);
    }

    const isCancelado = cupom.status === "cancelado";
    const totalReal = cupom.itens.reduce((s, i) => s + (i.valor * i.quantidade), 0);

    let html = "";
    html += "<div class='header-container'>";
    html +=   "<div class='loja-info'" + (!mostrarNumPedido ? " style='width: 100%; text-align: center;'" : "") + ">";
    html +=     "<h2" + (!mostrarNumPedido ? " style='text-align: center;'" : "") + ">" + configLoja.nome + "</h2>";
    html +=     "<p" + (!mostrarNumPedido ? " style='text-align: center;'" : "") + ">CNPJ: " + configLoja.cnpj + "</p>";
    html +=     "<p" + (!mostrarNumPedido ? " style='text-align: center;'" : "") + ">IE: ISENTO</p>";
    html +=   "</div>";
    
    if (mostrarNumPedido) {
        html +=   "<div class='pedido-box'>";
        html +=     "<span class='pedido-box-label'>PEDIDO</span>";
        html +=     "<span class='pedido-box-numero'>" + numPedidoFormatado + "</span>";
        html +=   "</div>";
    }
    
    html += "</div>";
    html += "<div class='divider'></div>";
    html += "<p class='titulo-cupom'>" + (isCancelado ? "*** CANCELADO ***" : "NÃO FISCAL") + "</p>";
    html += "<div class='divider'></div>";
    html += "<div class='info-line'><span>Data: " + dataHora + "</span></div>";
    html += "<div class='info-line'><span>Op: " + operador.substring(0,10) + "</span><span>Cupom: " + cupomIdText + "</span></div>";
    
    if (cupom.cliente || cupom.observacao) {
        html += "<div class='divider'></div>";
        if (cupom.cliente) {
            html += "<div class='info-line'><span>CLIENTE:</span><span style='text-align: right;'>" + cupom.cliente.toUpperCase() + "</span></div>";
        }
        if (cupom.observacao) {
            html += "<div style='font-size: 10px; margin: 3px 0; text-align: left;'>OBS: " + cupom.observacao.toUpperCase() + "</div>";
        }
    }

    html += "<div class='divider'></div>";
    html += "<table><thead><tr><th>QTD</th><th>DESC</th><th class='right'>TOT</th></tr></thead><tbody>";
    
    cupom.itens.forEach(item => {
        html += "<tr>" +
                "<td class='center'>" + item.quantidade + "</td>" +
                "<td>" + (item.nome || "").substring(0, 12) + "</td>" +
                "<td class='right'>" + (item.valor * item.quantidade).toFixed(2) + "</td>" +
                "</tr>";
    });
    html += "</tbody></table><div class='divider'></div>";

    if (isCancelado) {
        html += "<div class='info-line' style='font-size:11px; text-decoration:line-through;'><span>TOTAL:</span><span>R$ " + totalReal.toFixed(2) + "</span></div>";
        html += "<div class='info-line' style='font-size:11px;'><span>ESTORNO:</span><span>R$ " + totalReal.toFixed(2) + "</span></div>";
    } else {
        html += "<div class='info-line' style='font-size:12px;'><span>TOTAL:</span><span>R$ " + cupom.total.toFixed(2) + "</span></div>";
    }
    html += "<div class='divider'></div>";
    html += "<div class='info-line'><span>PAGTO:</span><span>" + (cupom.formaPagamento || "").toUpperCase() + "</span></div>";
    html += "<div class='divider'></div>";
    html += "<p style='margin-top:5px; text-align:center;'>Obrigado!</p>";
    html += "<p style='text-align:center;'>Volte Sempre!</p>";

    return html;
}

function exibirDetalhesCupom(cupom) {
    cupomSelecionadoAtual = cupom;
    const content = document.getElementById("resultado-cupom-content");
    if (!content) return;

    const isCancelado = cupom.status === "cancelado";
    let html = "<div id='area-impressao-cupom' class='cupom-print'>" + montarConteudoCupom(cupom) + "</div>";

    html += "<div class='botoes-cupom-acoes'>";
    html += "<button onclick='reimprimirCupomCentral()' style='background-color:#2980b9; color:white;'>🖨️ Imprimir 2ª Via</button>";
    if (!isCancelado) {
        html += "<button onclick='cancelarCupomCentral()' style='background-color:#e74c3c; color:white;'>🗑️ Cancelar Venda</button>";
    }
    html += "</div>";

    content.innerHTML = html;
}

function reimprimirCupomCentral() {
    if (!cupomSelecionadoAtual) return;
    const iframe = document.getElementById("iframe-impressao");
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    var configEmp = obterDados("configEmpresa") || {};
    var impressora = configEmp.tamanhoImpressora || "58";
    var cssPageSize = impressora === "80" ? "80mm auto" : "48mm auto";
    var cssBodyWidth = impressora === "80" ? "74mm" : "44mm";
    var cssFontSize = impressora === "80" ? "12px" : "11px"; 
    var cssTitleSize = impressora === "80" ? "14px" : "12px";

    const cssCupom =
        "@page { size: " + cssPageSize + "; margin: 0; } " +
        "body { font-family: 'Courier New', Courier, monospace; font-size: " + cssFontSize + "; width: " + cssBodyWidth + "; margin: 0 auto; padding: 5px; background: #fff; position: relative; } " +
        "* { color: #000 !important; font-weight: 900 !important; } " + 
        ".header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; } " +
        ".loja-info { max-width: 100px; text-align: left; } " +
        ".loja-info h2 { margin: 0; font-size: " + cssTitleSize + "; text-transform: uppercase; line-height: 1.1; } " +
        ".loja-info p { margin: 2px 0 0 0; font-size: " + cssFontSize + "; text-align: left; } " +
        ".pedido-box { border: 1px solid #000; padding: 2px; text-align: center; background: #fff; min-width: 45px; } " +
        ".pedido-box-label { font-size: 8px; text-transform: uppercase; display: block; margin-bottom: -2px; } " +
        ".pedido-box-numero { font-size: 16px; display: block; line-height: 1.1; } " +
        ".divider { border-top: 1px dashed #000; margin: 4px 0; } " +
        "p.titulo-cupom { margin: 2px 0; text-align: center; font-size: " + cssFontSize + "; } " +
        "table { width: 100%; border-collapse: collapse; font-size: " + cssFontSize + "; margin: 4px 0; } " +
        "th { border-bottom: 1px dashed #000; padding-bottom: 2px; text-align: left; font-size: " + cssFontSize + "; } " +
        "td { padding: 2px 0; vertical-align: top; word-wrap: break-word; } " +
        ".right { text-align: right; } .center { text-align: center; } " +
        ".info-line { display: flex; justify-content: space-between; font-size: " + cssFontSize + "; margin: 2px 0; }";

    const corpo = montarConteudoCupom(cupomSelecionadoAtual);
    const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" + cssCupom + "</style></head><body>" + corpo + "</body></html>";

    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 400);
}

function cancelarCupomCentral() {
    if (!cupomSelecionadoAtual) return;
    const senhaAdmin = prompt("🔐 Digite a Senha Master do Sistema para cancelar a venda:");
    
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    if (senhaAdmin !== senhasSys.master) { alert("Senha incorreta!"); return; }

    const devolverEstoque = confirm("Devolver produtos ao estoque?");
    const movimentacoes = obterDados("movimentacoes") || {};
    const produtosDoEstoque = obterDados("produtos") || {};
    const resumoFormas = obterDados("resumoFormas") || { Pix:0, Crédito:0, Débito:0, Dinheiro:0, Cheque:0, VR:0, Misto:0 };

    const dataVenda = cupomSelecionadoAtual.data;
    const idVenda = cupomSelecionadoAtual.idCupom;

    if (movimentacoes[dataVenda]) {
        movimentacoes[dataVenda].forEach(mv => {
            if (mv.idCupom === idVenda) {
                mv.tipoMovimento = "cancelado";
                if (devolverEstoque) {
                    const cod = mv.codigo;
                    const qtd = parseInt(mv.quantidade) || 0;
                    if (produtosDoEstoque[cod]) produtosDoEstoque[cod].quantidade += qtd;
                }
            }
        });

        const forma = cupomSelecionadoAtual.formaPagamento;
        if (resumoFormas[forma] !== undefined) {
            resumoFormas[forma] = Math.max(0, resumoFormas[forma] - cupomSelecionadoAtual.total);
        }

        salvarDados("movimentacoes", movimentacoes);
        salvarDados("resumoFormas", resumoFormas);
        if (devolverEstoque) salvarDados("produtos", produtosDoEstoque);

        alert("✅ Pedido cancelado!");
        carregarEAgruparCupons();
    }
}

window.filtrarCupons = filtrarCupons;
window.limparBuscaCupom = limparBuscaCupom;
window.reimprimirCupomCentral = reimprimirCupomCentral;
window.cancelarCupomCentral = cancelarCupomCentral;