import { $ } from '../core/state.js';

const menus = {
  file: [['Novo documento', 'new'], ['Abrir imagem…', 'open'], ['Abrir projeto MCUT…', 'openProject'], ['sep'], ['Salvar projeto (.mcut)', 'saveProject'], ['Exportar PNG…', 'export'], ['Exportar PSD achatado…', 'exportPsd'], ['Exportar PSB achatado…', 'exportPsb'], ['Exportar caminhos SVG…', 'exportPaths']],
  edit: [['Desfazer', 'undo'], ['Refazer', 'redo'], ['sep'], ['Adicionar camada', 'newLayer'], ['Adicionar grupo', 'newGroup'], ['Adicionar camada de ajuste', 'newAdjustment'], ['Duplicar camada', 'duplicate']],
  image: [['Recortar para seleção', 'cropSelection'], ['Ajustar à tela', 'fit'], ['Escala de cinza', 'grayscale'], ['Inverter cores', 'invert']],
  layer: [['Nova camada', 'newLayer'], ['Novo grupo', 'newGroup'], ['Camada de ajuste', 'newAdjustment'], ['Adicionar máscara', 'addMask'], ['Duplicar', 'duplicate'], ['Excluir', 'delete'], ['Mesclar abaixo', 'merge']],
  select: [['Seleção retangular', 'marquee'], ['Seleção elíptica', 'ellipse'], ['Laço', 'lasso'], ['Varinha mágica', 'wand'], ['Seleção rápida', 'quick'], ['Selecionar tudo', 'selectAll'], ['Inverter seleção', 'invertSelection'], ['Suavizar borda…', 'featherSelection'], ['Refinar borda…', 'refineSelection'], ['Salvar seleção como canal…', 'saveSelection'], ['Carregar seleção…', 'loadSelection'], ['Desmarcar', 'clearSelection']],
  filter: [['Desfoque', 'blur'], ['Escala de cinza', 'grayscale'], ['Inverter', 'invert'], ['Brilho…', 'brightness']],
  view: [['Ajustar à tela', 'fit'], ['Zoom 100%', 'zoom100'], ['Zoom 50%', 'zoom50']],
  help: [['Atalhos', 'help'], ['Licença AGPL-3.0', 'license'], ['Sobre MangaCut Studio', 'about']]
};

export function bindMenus(runAction) {
  const pop = $('menuPopover');
  pop.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    runAction(button.dataset.action);
    pop.classList.add('hidden');
  });
  document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => {
    pop.replaceChildren();
    for (const item of menus[button.dataset.menu] || []) {
      if (item[0] === 'sep') { const sep = document.createElement('div'); sep.className = 'menu-sep'; pop.append(sep); continue; }
      const action = document.createElement('button'); action.textContent = item[0]; action.dataset.action = item[1]; pop.append(action);
    }
    pop.style.left = `${Math.max(8, button.getBoundingClientRect().left)}px`;
    pop.classList.remove('hidden');
  }));
}
