// ==========================================
// FUNÇÕES DE SINCRONIZAÇÃO NATIVA
// ==========================================
window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};
const obterDados = window.obterDados;
const salvarDados = window.salvarDados;

let produtos = {};
let produtoEmEdicao = null; 
let dadosImportacaoPendente = null; // Variável Global para segurar o backup lido

function fecharModal(idModal) { document.getElementById(idModal).style.display = 'none'; }

function showMessage(msg, isError = false) {
  const messageElement = document.getElementById("message");
  if (messageElement) {
    messageElement.textContent = msg;
    messageElement.style.color = isError ? "red" : "green";
    messageElement.style.display = "block";
    setTimeout(() => (messageElement.style.display = "none"), 3000);
  } else {
    alert(msg);
  }
}

function updateLowStockList() {
  const lowStockList = document.getElementById("low-stock-list");
  if (!lowStockList) return;
  lowStockList.innerHTML = "";
  const lowStockProducts = Object.values(produtos).filter(p => p.quantidade <= 5 && p.quantidade > 0);

  if (lowStockProducts.length === 0) {
    lowStockList.innerHTML = "<p>Nenhum produto com estoque baixo.</p>";
    return;
  }
  lowStockProducts.forEach(p => {
    const pElement = document.createElement("p");
    pElement.textContent = `${p.nome}: ${p.quantidade} unidades restantes`;
    lowStockList.appendChild(pElement);
  });
}

function abrirModalVerificarQuantidade() {
    document.getElementById('modalEditarProduto').style.display = 'flex';
    document.getElementById('editProdutoCodigo').value = '';
    document.getElementById('editProdutoNome').value = '';
    document.getElementById('editProdutoQuantidade').value = '';
    document.getElementById('editProdutoPreco').value = '';
    document.getElementById('editProdutoCodigo').removeAttribute('readonly'); 
    document.getElementById('editProdutoCodigo').focus();
    
    document.getElementById('editProdutoCodigo').onkeypress = function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const barcode = this.value.trim();
            if (produtos[barcode]) {
                const produto = produtos[barcode];
                document.getElementById('editProdutoNome').value = produto.nome;
                document.getElementById('editProdutoQuantidade').value = produto.quantidade;
                document.getElementById('editProdutoPreco').value = produto.valor;
                produtoEmEdicao = barcode; 
                document.getElementById('editProdutoCodigo').setAttribute('readonly', 'true');
            } else {
                showMessage("Produto não encontrado.", true);
                this.value = '';
                produtoEmEdicao = null;
            }
        }
    };
}
function fecharModalEditarProduto() { document.getElementById('modalEditarProduto').style.display = 'none'; }

function abrirModalRegistrarProduto() {
    document.getElementById('modalRegistrarProduto').style.display = 'flex';
    document.getElementById('newBarcodeModal').value = '';
    document.getElementById('newNameModal').value = '';
    document.getElementById('newStockModal').value = '1';
    document.getElementById('newPriceModal').value = '';
}
function fecharModalRegistrarProduto() { document.getElementById('modalRegistrarProduto').style.display = 'none'; }

function registerProductModal() {
  const newBarcode = document.getElementById("newBarcodeModal").value.trim();
  const newName = document.getElementById("newNameModal").value.trim();
  const newStock = parseInt(document.getElementById("newStockModal").value.trim());
  const newPrice = parseFloat(document.getElementById("newPriceModal").value.trim());

  if (!newBarcode || !newName || isNaN(newStock) || newStock <= 0 || isNaN(newPrice) || newPrice <= 0) return showMessage("Dados inválidos.", true);
  if (produtos[newBarcode]) return showMessage("Código de barras já existe.", true);
  
  produtos[newBarcode] = { nome: newName, quantidade: newStock, valor: newPrice };
  salvarDados("produtos", produtos);
  showMessage("Produto registrado!");
  fecharModalRegistrarProduto();
  updateLowStockList();
}

function solicitarSenha() {
  if (produtoEmEdicao) {
    document.getElementById("senhaModal").style.display = "flex";
    document.getElementById("senhaInput").value = "";
    setTimeout(() => document.getElementById("senhaInput").focus(), 100);
  } else {
    showMessage("Carregue um produto no modal para editar.", true);
  }
}

function verificarSenha(event) {
  if (event.key === "Enter") {
    const senha = document.getElementById("senhaInput").value;
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    
    if (senha === senhasSys.master) { 
      document.getElementById("senhaModal").style.display = "none";
      document.getElementById('editProdutoCodigo').removeAttribute('readonly'); 
      document.getElementById('editProdutoNome').removeAttribute('readonly');
      document.getElementById('editProdutoQuantidade').removeAttribute('readonly');
      document.getElementById('editProdutoPreco').removeAttribute('readonly');
      document.getElementById('editProdutoNome').focus(); 
    } else {
      showMessage("Senha incorreta!", true);
      document.getElementById("senhaInput").value = "";
    }
  }
}

function salvarEdicaoProduto() {
    const codigo = document.getElementById('editProdutoCodigo').value.trim();
    const nome = document.getElementById('editProdutoNome').value.trim();
    const quantidade = parseInt(document.getElementById('editProdutoQuantidade').value);
    const preco = parseFloat(document.getElementById('editProdutoPreco').value);

    if (!codigo || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(preco) || preco <= 0) return showMessage("Campos inválidos.", true);
    if (codigo !== produtoEmEdicao && produtos[codigo]) return showMessage(`O código já está em uso.`, true);
    
    if (produtoEmEdicao && codigo !== produtoEmEdicao) delete produtos[produtoEmEdicao];
    produtos[codigo] = { nome: nome, quantidade: quantidade, valor: preco };
    salvarDados("produtos", produtos);
    showMessage(`Produto atualizado!`);
    fecharModalEditarProduto();
    updateLowStockList();
}

// CORREÇÃO: Utilizando sessionStorage para validar permissão de acesso
function temPermissao(acao) {
    if (sessionStorage.getItem('userRole') === 'admin') return true;
    const logado = sessionStorage.getItem('usuarioLogado');
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === logado);
    if (user && user.permissoes && user.permissoes[acao]) return true;
    return false;
}

// ==========================================
// IMPORTAÇÃO / EXPORTAÇÃO DE BACKUP
// ==========================================
function exportarBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup_completo_bekas_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            dadosImportacaoPendente = JSON.parse(e.target.result);
            // ABRE O NOVO MODAL DE CONFIRMAÇÃO
            document.getElementById('modal-confirm-import').style.display = 'flex';
        } catch (error) {
            console.error(error);
            showMessage("Arquivo de backup inválido ou corrompido!", true);
        }
        document.getElementById('inputBackup').value = ''; 
    };
    reader.readAsText(file);
}

function executarImportacao() {
    fecharModal('modal-confirm-import');
    if (!dadosImportacaoPendente) return;

    const msgBox = document.getElementById("mensagemBaixa");
    if (msgBox) {
        msgBox.style.display = "block";
        msgBox.style.opacity = "1";
    }

    for (const key in dadosImportacaoPendente) {
        let valor = dadosImportacaoPendente[key];
        if (typeof valor === 'object' && valor !== null) {
            valor = JSON.stringify(valor);
        }
        localStorage.setItem(key, valor);
    }

    let segundos = 3;
    if (msgBox) msgBox.innerText = `⏳ Sincronizando com a Nuvem... Concluindo em ${segundos}s`;

    const timer = setInterval(() => {
        segundos--;
        if (msgBox) msgBox.innerText = `⏳ Sincronizando com a Nuvem... Concluindo em ${segundos}s`;

        if (segundos <= 0) {
            clearInterval(timer);
            if (msgBox) msgBox.style.display = "none";
            // MOSTRA O NOVO MODAL DE SUCESSO
            document.getElementById('modal-sucesso-import').style.display = 'flex';
        }
    }, 1000);
}

// ==========================================
// APAGAR DADOS (RESET TOTAL)
// ==========================================
function confirmarApagarDados() {
    if (!temPermissao('apagar_tudo')) return showMessage("Acesso Negado.", true);
    // ABRE O NOVO MODAL DE CONFIRMAÇÃO
    document.getElementById('modal-confirm-apagar').style.display = 'flex';
}

function pedirSenhaApagar() {
    fecharModal('modal-confirm-apagar');
    document.getElementById('input-senha-apagar').value = '';
    // ABRE O NOVO MODAL DE SENHA
    document.getElementById('modal-senha-apagar').style.display = 'flex';
    setTimeout(() => document.getElementById('input-senha-apagar').focus(), 100);
}

function executarApagarDados() {
    const senha = document.getElementById('input-senha-apagar').value;
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    
    if (senha === senhasSys.master) { 
        fecharModal('modal-senha-apagar');
        
        const msgBox = document.getElementById("mensagemBaixa");
        if (msgBox) {
            msgBox.innerText = "⏳ Sincronizando exclusão com a Nuvem. Aguarde...";
            msgBox.style.display = "block";
            msgBox.style.opacity = "1";
        }

        let usuarios = [{ usuario: "admin", senha: "1996", role: "admin" }];
        
        salvarDados("produtos", {});
        salvarDados("movimentacoes", {});
        salvarDados("pedidosCozinha", {});
        salvarDados("clientesFidelidade", {});
        salvarDados("resumoFormas", { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Misto: 0 });
        salvarDados("usuarios", usuarios);
        
        salvarDados("numeroPedidoAtual", 1);
        salvarDados("valorAberturaCaixa", 0);
        salvarDados("caixaAbertoData", null);
        salvarDados("statusCaixaAberto", false);
        salvarDados("ultimaVenda", null);
        
        localStorage.removeItem("caixa_aberto_status");
        localStorage.removeItem("caixa_valor_abertura");

        setTimeout(function() {
            if (msgBox) msgBox.style.display = "none";
            // MOSTRA O NOVO MODAL DE SUCESSO
            document.getElementById('modal-sucesso-apagar').style.display = 'flex';
        }, 2000);

    } else {
        showMessage("Senha incorreta. Operação cancelada.", true);
        fecharModal('modal-senha-apagar');
    }
}

// ==========================================
// CONFIGURAÇÕES DA EMPRESA E O RESTANTE
// ==========================================
function toggleFidelidadeConfig() {
    let chk = document.getElementById('emp-usar-fidelidade');
    let divOpcoes = document.getElementById('config-fidelidade-opcoes');
    if(chk && divOpcoes) divOpcoes.style.display = chk.checked ? 'block' : 'none';
}

function abrirModalConfigEmpresa() {
    if (!temPermissao('config_empresa')) return showMessage("Acesso Negado.", true);
    let config = obterDados("configEmpresa") || { 
        usarMonitorCozinha: false, usarNumeroPedido: true, tamanhoImpressora: "58", 
        usarFidelidade: false, fidelidadeMeta: 10, fidelidadeBrinde: "", usarEstoqueNegativo: false 
    };
    
    document.getElementById('emp-nome-cabecalho').value = config.nomeCabecalho || "🛒 BEKAS BURGUER - Estoque";
    if(document.getElementById('emp-usar-monitor-cozinha')) document.getElementById('emp-usar-monitor-cozinha').checked = config.usarMonitorCozinha;
    if(document.getElementById('emp-usar-numero-pedido')) document.getElementById('emp-usar-numero-pedido').checked = config.usarNumeroPedido !== false;
    if(document.getElementById('emp-tamanho-impressora')) document.getElementById('emp-tamanho-impressora').value = config.tamanhoImpressora || "58";
    if(document.getElementById('emp-usar-backup')) document.getElementById('emp-usar-backup').checked = config.usarBackup !== false;
    if(document.getElementById('emp-usar-modal-cliente')) document.getElementById('emp-usar-modal-cliente').checked = config.usarModalCliente !== false;
    
    let chkNegativo = document.getElementById('emp-usar-estoque-negativo');
    if (chkNegativo) chkNegativo.checked = config.usarEstoqueNegativo === true;

    let chkFid = document.getElementById('emp-usar-fidelidade');
    if (chkFid) {
        chkFid.checked = config.usarFidelidade === true;
        toggleFidelidadeConfig();
        document.getElementById('emp-fidelidade-meta').value = config.fidelidadeMeta || 10;
        
        let selectBrinde = document.getElementById('emp-fidelidade-brinde');
        selectBrinde.innerHTML = '<option value="">-- Escolha o Brinde --</option>';
        let prods = obterDados("produtos") || {};
        Object.keys(prods).forEach(codigo => {
            selectBrinde.innerHTML += `<option value="${prods[codigo].nome}">${prods[codigo].nome}</option>`;
        });
        selectBrinde.value = config.fidelidadeBrinde || "";
    }
    
    document.getElementById('modalConfigEmpresa').style.display = 'flex';
}

function salvarConfigEmpresa() {
    let config = obterDados("configEmpresa") || {};
    config.nomeCabecalho = document.getElementById('emp-nome-cabecalho').value.trim() || "🛒 BEKAS BURGUER - Estoque";
    config.usarMonitorCozinha = document.getElementById('emp-usar-monitor-cozinha') ? document.getElementById('emp-usar-monitor-cozinha').checked : false;
    config.usarNumeroPedido = document.getElementById('emp-usar-numero-pedido') ? document.getElementById('emp-usar-numero-pedido').checked : true;
    config.tamanhoImpressora = document.getElementById('emp-tamanho-impressora') ? document.getElementById('emp-tamanho-impressora').value : "58";
    config.usarBackup = document.getElementById('emp-usar-backup') ? document.getElementById('emp-usar-backup').checked : true;
    config.usarModalCliente = document.getElementById('emp-usar-modal-cliente') ? document.getElementById('emp-usar-modal-cliente').checked : true;
    
    let chkNegativo = document.getElementById('emp-usar-estoque-negativo');
    config.usarEstoqueNegativo = chkNegativo ? chkNegativo.checked : false;

    let chkFid = document.getElementById('emp-usar-fidelidade');
    config.usarFidelidade = chkFid ? chkFid.checked : false;
    config.fidelidadeMeta = parseInt(document.getElementById('emp-fidelidade-meta').value) || 10;
    config.fidelidadeBrinde = document.getElementById('emp-fidelidade-brinde').value || "";
    
    salvarDados("configEmpresa", config);
    showMessage("Configurações da Empresa salvas com sucesso!");
    fecharModal('modalConfigEmpresa');
    aplicarConfiguracoesEmpresaGeral();
    aplicarPermissoesPainel();
}

function aplicarConfiguracoesEmpresaGeral() {
    let config = obterDados("configEmpresa") || {};
    let nomeHeader = config.nomeCabecalho || "🛒 BEKAS BURGUER - Estoque";
    let elHeader = document.getElementById("header-nome-empresa") || document.querySelector(".header-logo span");
    if(elHeader) elHeader.innerText = nomeHeader;
}

function abrirModalSenhasSistema() {
    // CORREÇÃO: Usando sessionStorage no admin check
    if (sessionStorage.getItem('userRole') !== 'admin') return showMessage("Acesso Negado.", true);
    let senhas = obterDados("senhasSistema") || { master: "1996", cancelarItem: "2201", fecharCaixa: "2201" };
    document.getElementById('senha-sys-master').value = senhas.master;
    document.getElementById('senha-sys-cancelar').value = senhas.cancelarItem;
    document.getElementById('senha-sys-fechar').value = senhas.fecharCaixa;
    document.getElementById('modalSenhasSistema').style.display = 'flex';
}

function salvarSenhasSistema() {
    let senhas = {
        master: document.getElementById('senha-sys-master').value.trim() || "1996",
        cancelarItem: document.getElementById('senha-sys-cancelar').value.trim() || "2201",
        fecharCaixa: document.getElementById('senha-sys-fechar').value.trim() || "2201"
    };
    salvarDados("senhasSistema", senhas);
    showMessage("Senhas de segurança atualizadas!");
    fecharModal('modalSenhasSistema');
}

function verificarAdmin() {
    let usuarios = obterDados('usuarios') || [];
    if (!usuarios.find(u => u.usuario === 'admin')) {
        usuarios.push({ usuario: 'admin', senha: '1996', role: 'admin' });
        salvarDados('usuarios', usuarios);
    }
}
verificarAdmin(); 

function abrirModalCriarUsuario() {
    if (!temPermissao('criar_usuario')) return showMessage("Acesso Negado.", true);
    document.getElementById('novo-usuario-nome').value = '';
    document.getElementById('novo-usuario-senha').value = '';
    document.getElementById('modal-criar-usuario').style.display = 'flex';
}

function criarUsuario() {
    const nome = document.getElementById('novo-usuario-nome').value.trim();
    const senha = document.getElementById('novo-usuario-senha').value;
    if (!nome || !senha) return showMessage("Preencha nome e senha!", true);
    
    let usuarios = obterDados('usuarios') || [];
    if (usuarios.find(u => u.usuario === nome)) return showMessage("Usuário já existe!", true);
    
    usuarios.push({ 
        usuario: nome, senha: senha, role: 'operador',
        permissoes: { 
            caixa: false, cupons: false, cozinha: false, fidelidade: false, registrar_produto: false, todos_produtos: false, 
            verificar_quantidade: false, fim_estoque: false, faturamento: false, relatorio: false, 
            conectar_firebase: false, apagar_tudo: false, config_empresa: false, criar_usuario: false, 
            editar_usuario: false, excluir_usuario: false, ver_usuarios: false 
        }
    });
    
    salvarDados('usuarios', usuarios);
    showMessage("Usuário criado com sucesso!");
    fecharModal('modal-criar-usuario');
}

function abrirModalEditarUsuario() {
    if (!temPermissao('editar_usuario')) return showMessage("Acesso Negado.", true);
    let usuarios = obterDados('usuarios') || [];
    const select = document.getElementById('select-editar-usuario');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    usuarios.forEach(u => select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`);
    document.getElementById('editar-usuario-nova-senha').value = '';
    document.getElementById('modal-editar-usuario').style.display = 'flex';
}

function editarUsuario() {
    const nome = document.getElementById('select-editar-usuario').value;
    const novaSenha = document.getElementById('editar-usuario-nova-senha').value;
    if (!nome || !novaSenha) return showMessage("Preencha todos os campos!", true);
    let usuarios = obterDados('usuarios') || [];
    const index = usuarios.findIndex(u => u.usuario === nome);
    if (index !== -1) {
        usuarios[index].senha = novaSenha;
        salvarDados('usuarios', usuarios);
        showMessage("Senha atualizada!");
        fecharModal('modal-editar-usuario');
    }
}

function abrirModalExcluirUsuario() {
    if (!temPermissao('excluir_usuario')) return showMessage("Acesso Negado.", true);
    let usuarios = obterDados('usuarios') || [];
    const select = document.getElementById('select-excluir-usuario');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    usuarios.forEach(u => {
        if (u.usuario !== 'admin') select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
    });
    document.getElementById('modal-excluir-usuario').style.display = 'flex';
}

function excluirUsuario() {
    const nome = document.getElementById('select-excluir-usuario').value;
    if (!nome) return showMessage("Selecione um usuário!", true);
    if (nome === 'admin') return showMessage("O Admin não pode ser excluído.", true);
    let usuarios = obterDados('usuarios') || [];
    usuarios = usuarios.filter(u => u.usuario !== nome);
    salvarDados('usuarios', usuarios);
    showMessage("Usuário excluído!");
    fecharModal('modal-excluir-usuario');
}

function abrirModalListarUsuarios() {
    if (!temPermissao('ver_usuarios')) return showMessage("Acesso Negado.", true);
    let usuarios = obterDados('usuarios') || [];
    const divLista = document.getElementById('lista-de-usuarios-cadastrados');
    divLista.innerHTML = '';
    usuarios.forEach(u => {
        divLista.innerHTML += `<div style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
            <div><strong>${u.usuario}</strong> <br><span style="color: #777; font-size: 11px;">(${u.role === 'admin' ? 'Administrador' : 'Operador'})</span></div>
            <div style="background: #f1f1f1; padding: 5px 10px; border-radius: 5px; font-family: monospace; border: 1px solid #ccc;">Senha: <b>${u.senha}</b></div>
        </div>`;
    });
    document.getElementById('modal-listar-usuarios').style.display = 'flex';
}

function abrirModalPermissoes() {
    // CORREÇÃO: Usando sessionStorage no admin check
    if (sessionStorage.getItem('userRole') !== 'admin') return showMessage("Acesso Negado.", true);
    const select = document.getElementById('selectUsuarioPermissao');
    let usuarios = obterDados('usuarios') || [];
    select.innerHTML = '<option value="">-- Escolha um Operador --</option>';
    usuarios.forEach(u => {
        if (u.usuario !== 'admin') select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
    });
    document.getElementById('listaPermissoes').style.display = 'none';
    document.getElementById('modalPermissoes').style.display = 'flex';
}

function carregarPermissoesUsuario() {
    const nome = document.getElementById('selectUsuarioPermissao').value;
    const divLista = document.getElementById('listaPermissoes');
    if (!nome) { divLista.style.display = 'none'; return; }
    
    divLista.style.display = 'block';
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === nome);
    const p = (user && user.permissoes) ? user.permissoes : {};

    document.getElementById('perm-caixa').checked = p.caixa || false;
    document.getElementById('perm-cupons').checked = p.cupons || false;
    document.getElementById('perm-cozinha').checked = p.cozinha || false;
    document.getElementById('perm-fidelidade').checked = p.fidelidade || false;
    document.getElementById('perm-registrar_produto').checked = p.registrar_produto || false;
    document.getElementById('perm-todos_produtos').checked = p.todos_produtos || false;
    document.getElementById('perm-verificar_quantidade').checked = p.verificar_quantidade || false;
    document.getElementById('perm-fim_estoque').checked = p.fim_estoque || false;
    document.getElementById('perm-faturamento').checked = p.faturamento || false;
    document.getElementById('perm-relatorio').checked = p.relatorio || false;
    
    document.getElementById('perm-conectar_firebase').checked = p.conectar_firebase || false;
    document.getElementById('perm-apagar_tudo').checked = p.apagar_tudo || false;
    document.getElementById('perm-config_empresa').checked = p.config_empresa || false;
    document.getElementById('perm-criar_usuario').checked = p.criar_usuario || false;
    document.getElementById('perm-editar_usuario').checked = p.editar_usuario || false;
    document.getElementById('perm-excluir_usuario').checked = p.excluir_usuario || false;
    document.getElementById('perm-ver_usuarios').checked = p.ver_usuarios || false;
}

function salvarPermissoesUsuario() {
    const nome = document.getElementById('selectUsuarioPermissao').value;
    if (!nome) return showMessage("Selecione um usuário primeiro.", true);
    
    let usuarios = obterDados('usuarios') || [];
    const index = usuarios.findIndex(u => u.usuario === nome);
    
    if (index !== -1) {
        usuarios[index].permissoes = {
            caixa: document.getElementById('perm-caixa').checked,
            cupons: document.getElementById('perm-cupons').checked,
            cozinha: document.getElementById('perm-cozinha').checked,
            fidelidade: document.getElementById('perm-fidelidade').checked,
            registrar_produto: document.getElementById('perm-registrar_produto').checked,
            todos_produtos: document.getElementById('perm-todos_produtos').checked,
            verificar_quantidade: document.getElementById('perm-verificar_quantidade').checked,
            fim_estoque: document.getElementById('perm-fim_estoque').checked,
            faturamento: document.getElementById('perm-faturamento').checked,
            relatorio: document.getElementById('perm-relatorio').checked,
            conectar_firebase: document.getElementById('perm-conectar_firebase').checked,
            apagar_tudo: document.getElementById('perm-apagar_tudo').checked,
            config_empresa: document.getElementById('perm-config_empresa').checked,
            criar_usuario: document.getElementById('perm-criar_usuario').checked,
            editar_usuario: document.getElementById('perm-editar_usuario').checked,
            excluir_usuario: document.getElementById('perm-excluir_usuario').checked,
            ver_usuarios: document.getElementById('perm-ver_usuarios').checked
        };
        salvarDados('usuarios', usuarios);
        showMessage(`Permissões salvas com sucesso!`);
        fecharModal('modalPermissoes');
    }
}

// CORREÇÃO: Utilizando sessionStorage para aplicar permissões dinâmicas no painel
function aplicarPermissoesPainel() {
    const role = sessionStorage.getItem('userRole');
    let configEmp = obterDados("configEmpresa") || { usarBackup: true, usarMonitorCozinha: false, usarFidelidade: false };
    
    if (document.getElementById('btn-backup-export')) document.getElementById('btn-backup-export').style.display = configEmp.usarBackup ? 'inline-block' : 'none';
    if (document.getElementById('btn-backup-import')) document.getElementById('btn-backup-import').style.display = configEmp.usarBackup ? 'inline-block' : 'none';

    if (role === 'admin') {
        if (!localStorage.getItem("firebaseConfigJSON") && document.getElementById("alerta-firebase")) {
            document.getElementById("alerta-firebase").style.display = "block";
        }
        if(document.getElementById('zona-apagar-tudo')) document.getElementById('zona-apagar-tudo').style.display = 'block';
        if(document.getElementById('btn-menu-config-emp')) document.getElementById('btn-menu-config-emp').style.display = 'block';
        if(document.getElementById('btn-menu-criar-usu')) document.getElementById('btn-menu-criar-usu').style.display = 'block';
        if(document.getElementById('btn-menu-editar-usu')) document.getElementById('btn-menu-editar-usu').style.display = 'block';
        if(document.getElementById('btn-menu-excluir-usu')) document.getElementById('btn-menu-excluir-usu').style.display = 'block';
        if(document.getElementById('btn-menu-ver-usu')) document.getElementById('btn-menu-ver-usu').style.display = 'block';
        if(document.getElementById('btn-menu-conectar-firebase')) document.getElementById('btn-menu-conectar-firebase').style.display = 'block';
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = 'block';
        
        if(document.getElementById('card-cozinha')) document.getElementById('card-cozinha').style.display = configEmp.usarMonitorCozinha ? 'block' : 'none';
        if(document.getElementById('card-fidelidade')) document.getElementById('card-fidelidade').style.display = configEmp.usarFidelidade ? 'block' : 'none';
        return; 
    }

    const usuarioLogado = sessionStorage.getItem("usuarioLogado");
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === usuarioLogado); 
    const p = (user && user.permissoes) ? user.permissoes : {};

    if(document.getElementById('card-caixa')) document.getElementById('card-caixa').style.display = p.caixa ? 'block' : 'none';
    if(document.getElementById('card-cupons')) document.getElementById('card-cupons').style.display = p.cupons ? 'block' : 'none';
    if(document.getElementById('card-cozinha')) document.getElementById('card-cozinha').style.display = (p.cozinha && configEmp.usarMonitorCozinha) ? 'block' : 'none';
    if(document.getElementById('card-fidelidade')) document.getElementById('card-fidelidade').style.display = (p.fidelidade && configEmp.usarFidelidade) ? 'block' : 'none';
    if(document.getElementById('card-registrar_produto')) document.getElementById('card-registrar_produto').style.display = p.registrar_produto ? 'block' : 'none';
    if(document.getElementById('card-todos_produtos')) document.getElementById('card-todos_produtos').style.display = p.todos_produtos ? 'block' : 'none';
    if(document.getElementById('card-verificar_quantidade')) document.getElementById('card-verificar_quantidade').style.display = p.verificar_quantidade ? 'block' : 'none';
    if(document.getElementById('card-fim_estoque')) document.getElementById('card-fim_estoque').style.display = p.fim_estoque ? 'block' : 'none';
    if(document.getElementById('card-faturamento')) document.getElementById('card-faturamento').style.display = p.faturamento ? 'block' : 'none';
    if(document.getElementById('card-relatorio')) document.getElementById('card-relatorio').style.display = p.relatorio ? 'block' : 'none';

    if(document.getElementById('btn-menu-conectar-firebase')) document.getElementById('btn-menu-conectar-firebase').style.display = p.conectar_firebase ? 'block' : 'none';
    if(document.getElementById('zona-apagar-tudo')) document.getElementById('zona-apagar-tudo').style.display = p.apagar_tudo ? 'block' : 'none';
    if(document.getElementById('btn-menu-config-emp')) document.getElementById('btn-menu-config-emp').style.display = p.config_empresa ? 'block' : 'none';
    if(document.getElementById('btn-menu-criar-usu')) document.getElementById('btn-menu-criar-usu').style.display = p.criar_usuario ? 'block' : 'none';
    if(document.getElementById('btn-menu-editar-usu')) document.getElementById('btn-menu-editar-usu').style.display = p.editar_usuario ? 'block' : 'none';
    if(document.getElementById('btn-menu-excluir-usu')) document.getElementById('btn-menu-excluir-usu').style.display = p.excluir_usuario ? 'block' : 'none';
    if(document.getElementById('btn-menu-ver-usu')) document.getElementById('btn-menu-ver-usu').style.display = p.ver_usuarios ? 'block' : 'none';

    if (!p.config_empresa && !p.criar_usuario && !p.editar_usuario && !p.excluir_usuario && !p.ver_usuarios && !p.conectar_firebase) {
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = 'none';
    } else {
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = 'block';
    }
}

function abrirModalConfigTema() {
    document.getElementById("modal-configuracoes-tema").style.display = "flex";
    document.getElementById("cor-fundo-header").value = localStorage.getItem("temaCorFundoHeader") || "#2c3e50";
    document.getElementById("cor-texto-header").value = localStorage.getItem("temaCorTextoHeader") || "#ffffff";
}

function salvarCoresTema() {
    var corFundo = document.getElementById("cor-fundo-header").value;
    var corTexto = document.getElementById("cor-texto-header").value;
    localStorage.setItem("temaCorFundoHeader", corFundo);
    localStorage.setItem("temaCorTextoHeader", corTexto);
    aplicarTemaVisual();
    fecharModal('modal-configuracoes-tema');
}

function aplicarTemaVisual() {
    var corFundo = localStorage.getItem("temaCorFundoHeader");
    var corTexto = localStorage.getItem("temaCorTextoHeader");
    var header = document.getElementById("main-header-bar");
    var footer = document.getElementById("main-footer-bar");
    if (header) { if (corFundo) header.style.backgroundColor = corFundo; if (corTexto) header.style.color = corTexto; }
    if (footer) { if (corFundo) footer.style.backgroundColor = corFundo; if (corTexto) footer.style.color = corTexto; }
    var fundoSalvo = localStorage.getItem("fundoTelaSistema");
    var bodyPainel = document.getElementById("painel-body");
    if (bodyPainel) bodyPainel.style.backgroundImage = fundoSalvo ? "url('" + fundoSalvo + "')" : "none";
    // CORREÇÃO: Exibir nome do operador logado via sessionStorage
    var nomeSpan = document.getElementById("nome-usuario-logado");
    if (nomeSpan) nomeSpan.innerText = sessionStorage.getItem("usuarioLogado") || "Operador";
}

function salvarImagemFundo() {
    var fileInput = document.getElementById('input-fundo-tela');
    var file = fileInput.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement("canvas");
                var ctx = canvas.getContext("2d");
                var MAX_WIDTH = 1920;
                var MAX_HEIGHT = 1080;
                var width = img.width;
                var height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                var dataUrl = canvas.toDataURL("image/jpeg", 0.6);

                try {
                    localStorage.setItem("fundoTelaSistema", dataUrl);
                    aplicarTemaVisual();
                    showMessage("Imagem de fundo aplicada com sucesso!");
                } catch (err) { showMessage("A imagem ainda é muito pesada. Tente uma foto mais simples.", true); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else { showMessage("Selecione uma imagem primeiro.", true); }
}

function removerImagemFundo() {
    localStorage.removeItem("fundoTelaSistema");
    document.getElementById("input-fundo-tela").value = "";
    aplicarTemaVisual();
}

function abrirModalFirebase() {
    if (!temPermissao('conectar_firebase')) return showMessage("Acesso Negado.", true);
    document.getElementById('modalFirebase').style.display = 'flex';
    var configAtual = localStorage.getItem("firebaseConfigJSON");
    if (configAtual) document.getElementById('firebaseConfigInput').value = configAtual;
}

function salvarConfigFirebase() {
    var configStr = document.getElementById('firebaseConfigInput').value.trim();
    if (!configStr) return showMessage("O campo está vazio.", true);
    try {
        JSON.parse(configStr);
        localStorage.setItem("firebaseConfigJSON", configStr);
        showMessage("Salvo! Recarregando...");
        window.location.reload();
    } catch (e) { showMessage("Erro: JSON inválido.", true); }
}

document.addEventListener("DOMContentLoaded", () => {
    aplicarTemaVisual();
    aplicarConfiguracoesEmpresaGeral(); 
    aplicarPermissoesPainel();
});

document.addEventListener("bancoPronto", () => {
    produtos = obterDados("produtos") || {};
    updateLowStockList(); 
    aplicarConfiguracoesEmpresaGeral(); 
    aplicarPermissoesPainel();
});

// Lembre-se de usar a referência correta do 'db' importada do seu firebase-banco.js
window.abrirModalBloqueioLocal = async () => {
    document.getElementById('modalBloqueioLocal').style.display = 'flex';
    
    // Puxa o status atual para mostrar no checkbox
    const licencaRef = doc(db, "config", "licenca");
    const docSnap = await getDoc(licencaRef);
    if (docSnap.exists()) {
        const dados = docSnap.data();
        document.getElementById('check-bloquear-local').checked = dados.bloqueado || false;
        document.getElementById('texto-bloqueio-local').value = dados.mensagem || "";
    }
};

window.salvarBloqueioLocal = async () => {
    const bloqueado = document.getElementById('check-bloquear-local').checked;
    const mensagem = document.getElementById('texto-bloqueio-local').value;
    
    try {
        await setDoc(doc(db, "config", "licenca"), {
            bloqueado: bloqueado,
            mensagem: mensagem,
            atualizadoEm: new Date()
        }, { merge: true });
        
        document.getElementById('modalBloqueioLocal').style.display = 'none';
    } catch(e) {
        alert("Erro ao salvar bloqueio: " + e.message);
    }
};