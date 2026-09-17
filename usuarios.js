function abrirModalCriarUsuario() {
  if (localStorage.getItem('userRole') !== 'admin') {
    alert("ACESSO NEGADO! Apenas o administrador pode criar utilizadores.");
    return;
  }
  document.getElementById('modalCriarUsuario').style.display = 'flex';
}

function abrirModalEditarUsuario() {
  if (localStorage.getItem('userRole') !== 'admin') {
    alert("ACESSO NEGADO! Apenas o administrador pode editar utilizadores.");
    return;
  }
  
  const usuarios = obterDados('usuarios') || [];
  const select = document.getElementById('nomeUsuarioEditar');
  if (select) {
      select.innerHTML = '<option value="">Selecione um utilizador</option>';
      usuarios.forEach(u => {
          select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
      });
  }
  document.getElementById('modalEditarUsuario').style.display = 'flex';
}

function abrirModalExcluirUsuario() {
  if (localStorage.getItem('userRole') !== 'admin') {
    alert("ACESSO NEGADO! Apenas o administrador pode excluir utilizadores.");
    return;
  }
  
  const usuarios = obterDados('usuarios') || [];
  const select = document.getElementById('nomeUsuarioExcluir');
  if (select) {
      select.innerHTML = '<option value="">Selecione um utilizador</option>';
      usuarios.forEach(u => {
          if (u.usuario !== 'admin') { 
              select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
          }
      });
  }
  document.getElementById('modalExcluirUsuario').style.display = 'flex';
}

function abrirModalListarUsuarios() {
  if (localStorage.getItem('userRole') !== 'admin') {
    alert("ACESSO NEGADO! Apenas o administrador pode listar utilizadores.");
    return;
  }
  document.getElementById('modalListarUsuarios').style.display = 'flex';
  listarUsuarios();
}

function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

function criarUsuario() {
  const nome = document.getElementById('nomeUsuario').value.trim();
  const senha = document.getElementById('senhaUsuario').value.trim();

  if (!nome || !senha) {
    alert('Por favor, preencha todos os campos.');
    return;
  }

  let usuarios = obterDados("usuarios") || [];
  const usuarioExistente = usuarios.find(u => u.usuario === nome);
  if (usuarioExistente) {
    alert('O utilizador já existe.');
    return;
  }

  usuarios.push({ usuario: nome, senha });
  salvarDados("usuarios", usuarios);
  alert('Utilizador criado com sucesso!');

  document.getElementById('nomeUsuario').value = '';
  document.getElementById('senhaUsuario').value = '';
  fecharModal('modalCriarUsuario');
}

function editarUsuario() {
  const nome = document.getElementById('nomeUsuarioEditar').value.trim();
  const novaSenha = document.getElementById('senhaUsuarioEditar').value.trim();

  if (!nome || !novaSenha) {
    alert('Selecione um utilizador e digite a nova senha.');
    return;
  }

  let usuarios = obterDados("usuarios") || [];
  const usuario = usuarios.find(u => u.usuario === nome);
  if (usuario) {
    usuario.senha = novaSenha;
    salvarDados("usuarios", usuarios);
    alert('Senha alterada com sucesso!');
    document.getElementById('senhaUsuarioEditar').value = '';
    fecharModal('modalEditarUsuario');
  } else {
    alert('Utilizador não encontrado.');
  }
}

function excluirUsuario() {
  const nome = document.getElementById('nomeUsuarioExcluir').value.trim();

  if (!nome) {
    alert('Selecione um utilizador para excluir.');
    return;
  }

  if (nome === "admin") {
    alert("O utilizador admin não pode ser excluído.");
    return;
  }

  let usuarios = obterDados("usuarios") || [];
  const novosUsuarios = usuarios.filter(u => u.usuario !== nome);

  if (novosUsuarios.length === usuarios.length) {
    alert('Utilizador não encontrado.');
    return;
  }

  salvarDados("usuarios", novosUsuarios);
  alert('Utilizador excluído com sucesso!');
  fecharModal('modalExcluirUsuario');
}

function listarUsuarios() {
  const container = document.getElementById('user-list');
  if (!container) return;
  container.innerHTML = '';

  let usuarios = obterDados("usuarios") || [];

  if (usuarios.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#777;">Nenhum utilizador encontrado.</p>';
      return;
  }

  usuarios.forEach(u => {
    const div = document.createElement('div');
    div.style.padding = "12px";
    div.style.borderBottom = "1px solid #eee";
    div.style.fontSize = "16px";
    div.style.fontWeight = "500";
    div.innerHTML = `👤 Utilizador: <span style="color:#007bff;">${u.usuario}</span>`;
    container.appendChild(div);
  });
}