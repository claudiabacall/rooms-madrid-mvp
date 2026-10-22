import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', {
  runScripts: 'outside-only'
});

dom.window.eval(
  readFileSync('assets/js/features/deleted-chat-view.js', 'utf8')
);

const { renderDeletedConversation } =
  dom.window.ROOMS_DELETED_CHAT_VIEW;

test('Muestra usuario eliminado y modo lectura', () => {
  const html = renderDeletedConversation([{
    body: 'Hola',
    mine: false,
    created_at: '2026-10-22T10:00:00Z'
  }]);

  assert.match(html, /Usuario eliminado/);
  assert.match(html, /solo lectura/);
  assert.doesNotMatch(html, /<input|<textarea|data-real-chat-action/i);
});

test('Escapa contenido potencialmente peligroso', () => {
  const html = renderDeletedConversation([{
    body: '<img src=x onerror=alert(1)>',
    mine: false,
    created_at: '2026-10-22T10:00:00Z'
  }]);

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('Distingue mensajes propios', () => {
  const html = renderDeletedConversation([{
    body: 'Mensaje propio',
    mine: true,
    created_at: '2026-10-22T10:00:00Z'
  }]);

  assert.match(html, /chat-message mine/);
});

test('Rechaza mensajes invalidos', () => {
  assert.throws(
    () => renderDeletedConversation([{ body: 'Hola' }]),
    /invalido/
  );
});

test('Gestiona historial vacio', () => {
  assert.match(
    renderDeletedConversation([]),
    /No hay mensajes conservados/
  );
});
