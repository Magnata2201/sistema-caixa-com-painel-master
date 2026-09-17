window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};

document.addEventListener("DOMContentLoaded", renderizarLista);
document.addEventListener("dadosAtualizados", renderizarLista);
document.addEventListener("bancoPronto", renderizarLista);

function renderizarLista() {
    let clientesObj = window.obterDados("clientesFidelidade") || {};
    let configEmp = window.obterDados("configEmpresa") || {};
    let meta = configEmp.fidelidadeMeta || 10;
    
    document.getElementById("info-meta").innerHTML = `<b>Configuração atual:</b> 1 Brinde a cada ${meta} compras.`;

    let termo = document.getElementById("busca-fidelidade").value.trim().toLowerCase();
    let tbody = document.getElementById("corpo-tabela");
    tbody.innerHTML = "";

    let clientesArray = Object.values(clientesObj);
    
    let filtrados = clientesArray.filter(c => {
        if (!termo) return true;
        return (c.nome && c.nome.toLowerCase().includes(termo)) || 
               (c.documento && c.documento.includes(termo)) || 
               (c.telefone && c.telefone.includes(termo));
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#777; padding: 30px;'>Nenhum cliente cadastrado ou encontrado na busca.</td></tr>";
        return;
    }

    filtrados.sort((a, b) => b.compras - a.compras).forEach(c => {
        let tr = document.createElement("tr");
        
        let faltam = meta - c.compras;
        let statusHtml = "";
        
        if (c.compras >= meta) {
            statusHtml = `<span class='brinde-tag'>🏆 PRÊMIO DISPONÍVEL!</span>`;
        } else {
            statusHtml = `<span class='meta-tag'>Faltam ${faltam} compras</span>`;
        }

        tr.innerHTML = `
            <td style="color: #2c3e50;"><strong>${c.nome}</strong></td>
            <td style="font-family: monospace;">${c.documento}</td>
            <td>${c.telefone || "Não informado"}</td>
            <td style="font-size: 18px; font-weight: bold; color: #3498db;">${c.compras} <span style="font-size:12px; font-weight:normal; color:#95a5a6;">/ ${meta}</span></td>
            <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}