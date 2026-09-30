(async () => {
  'use strict';
  const auth = window.ParatyAuth, $ = id => document.getElementById(id);
  let users = [], busy = false;
  const labels = {pending:'Pendente',active:'Liberado',suspended:'Suspenso'};
  const message = text => { $('adminMessage').textContent = text; };
  if (!auth?.client) { message('Recarregue a página para tentar novamente.'); return; }
  $('logoutBtn').onclick = async () => { try { await auth.client.auth.signOut({scope:'local'}); } finally { auth.clearSession(); location.replace(auth.url('login.html')); } };
  const render = () => {
    $('users').replaceChildren();
    const query = $('search').value.trim().toLocaleLowerCase('pt-BR'), filter = $('filter').value;
    const visible = users.filter(u => (filter === 'all' || u.status === filter) && (u.email+' '+u.name).toLocaleLowerCase('pt-BR').includes(query));
    $('summary').textContent = `${users.filter(u=>u.status==='pending').length} pendentes · ${users.filter(u=>u.status==='active').length} liberados · ${users.filter(u=>u.status==='suspended').length} suspensos`;
    if (!visible.length) { const empty = document.createElement('p'); empty.textContent='Nenhuma conta encontrada.'; $('users').append(empty); }
    for (const user of visible) {
      const card=document.createElement('article'); card.className='user-card';
      const title=document.createElement('h2'); title.textContent=user.email;
      const name=document.createElement('p'); name.textContent=user.name || 'Sem nome informado';
      const badge=document.createElement('span'); badge.className='status-pill status-'+user.status; badge.textContent=user.is_master?'Administrador master':labels[user.status];
      const date=document.createElement('p'); date.textContent='Cadastro: '+new Date(user.created_at).toLocaleString('pt-BR');
      card.append(title,name,badge,date);
      if (!user.is_master) {
        const actions=document.createElement('div');actions.className='access-actions';
        for (const status of ['active','suspended']) {
          if (status === user.status) continue;
          const button=document.createElement('button'); button.type='button'; button.className=status==='active'?'primary':'secondary'; button.textContent=status==='active'?'Liberar acesso':'Suspender acesso'; button.disabled=busy;
          button.onclick=async()=>{
            if(busy) return;busy=true;render();message('Salvando alteração…');
            try {
              const {error}=await auth.client.rpc('platform_set_access',{target_user:user.user_id,new_status:status});
              if(error) throw error;
              await refresh(false);message(`${user.email}: acesso ${status==='active'?'liberado':'suspenso'}.`);
            } catch { message('Não foi possível alterar o acesso. Verifique sua conexão e permissão de master.'); }
            finally {busy=false;render();}
          };
          actions.append(button);
        }
        card.append(actions);
      }
      $('users').append(card);
    }
  };
  const refresh=async(showMessage=true)=>{
    $('refreshBtn').disabled=true;
    try {
      const {data,error}=await auth.client.auth.getUser();
      if(!data.user && !error){location.replace(auth.url('login.html'));return;}
      if(error) throw error;
      const access=await auth.access();
      if(!access.is_master){$('adminControls').hidden=true;users=[];render();message('Somente o administrador master pode gerenciar acessos.');return;}
      const result=await auth.client.rpc('platform_list_access');if(result.error) throw result.error;
      users=result.data || [];$('adminControls').hidden=false;render();if(showMessage) message('Lista atualizada.');
    } catch(error){$('adminControls').hidden=true;users=[];render();message('Conecte-se à internet e entre com a conta master para gerenciar acessos.');if(!showMessage) throw error;}
    finally{$('refreshBtn').disabled=false;}
  };
  $('refreshBtn').onclick=()=>refresh();$('search').oninput=render;$('filter').onchange=render;
  await refresh();
})();
