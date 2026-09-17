window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};

// A tela atualizará sozinha ao detectar mudanças ou vendas novas
document.addEventListener("DOMContentLoaded", renderizarCozinha);
document.addEventListener("dadosAtualizados", renderizarCozinha);
document.addEventListener("bancoPronto", renderizarCozinha);

if (window.isBancoPronto) renderizarCozinha();

function renderizarCozinha() {
    let pedidosCozinha = window.obterDados("pedidosCozinha") || {};
    let grid = document.getElementById("grid-pedidos-cozinha");
    if (!grid) return;

    // Filtra apenas pedidos pendentes e ordena do mais antigo para o mais novo
    let pedidosPendentes = Object.values(pedidosCozinha)
        .filter(p => p.status === "pendente")
        .sort((a, b) => a.timestamp - b.timestamp);

    grid.innerHTML = "";

    if (pedidosPendentes.length === 0) {
        grid.innerHTML = "<div class='kds-vazio'>Nenhum pedido pendente. A cozinha está livre! 🎉</div>";
        return;
    }

    pedidosPendentes.forEach(pedido => {
        let card = document.createElement("div");
        card.className = "kds-card";

        // Monta a lista de itens
        let itensHTML = "";
        pedido.itens.forEach(item => {
            itensHTML += `<div class='kds-item'><span class='kds-qtd'>${item.quantidade}x</span> ${item.nome}</div>`;
        });

        // 1. LÓGICA DO NOME DO CLIENTE
        let nomeClienteStr = (pedido.cliente && pedido.cliente !== "Balcão") ? pedido.cliente.toUpperCase() : "BALCÃO";
        
        // 2. LÓGICA DA OBSERVAÇÃO BEM DESTACADA
        let obsHTML = "";
        if (pedido.observacao && pedido.observacao.trim() !== "") {
            obsHTML = `
            <div style="background-color: #f1c40f; color: #000; padding: 12px; border-radius: 6px; font-weight: 900; margin-top: 15px; font-size: 16px; border-left: 5px solid #d35400;">
                ⚠️ OBS: ${pedido.observacao.toUpperCase()}
            </div>`;
        }

        // Monta o Card completo
        card.innerHTML = `
            <div class='kds-card-header'>
                <span>#${pedido.numeroPedido}</span>
                <span class='kds-hora'>${pedido.hora}</span>
            </div>
            <div class='kds-card-body'>
                
                <!-- NOME DO CLIENTE EXIBIDO AQUI -->
                <div class='kds-cliente' style="font-size: 18px; color: #34db98; font-weight: bold;">
                    👤 Cliente: <span style="color: #fff;">${nomeClienteStr}</span>
                </div>
                
                <div style="margin-top: 15px;">
                    ${itensHTML}
                </div>
                
                <!-- CAIXA AMARELA DE OBSERVAÇÃO EXIBIDA AQUI -->
                ${obsHTML}
                
            </div>
            <button class='kds-btn' onclick="marcarComoPronto('${pedido.idCupom}')">✔ Pedido Pronto</button>
        `;

        grid.appendChild(card);
    });
}

// Quando o cozinheiro clica no botão verde, tira o pedido da tela
window.marcarComoPronto = function(idCupom) {
    let pedidosCozinha = window.obterDados("pedidosCozinha") || {};
    if (pedidosCozinha[idCupom]) {
        pedidosCozinha[idCupom].status = "pronto";
        window.salvarDados("pedidosCozinha", pedidosCozinha);
        renderizarCozinha();
    }
};