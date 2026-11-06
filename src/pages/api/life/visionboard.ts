import { UserError } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';
import { deleteTile, moveTile, saveTile, type BoardName } from '../../../lib/life/visionboard';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const id = form.str('id', 40);
  switch (form.str('action', 20)) {
    case 'save':
      await saveTile(person, {
        id,
        board: form.str('board', 10) as BoardName,
        item: form.str('item', 40),
        caption: form.str('caption', 300),
        image: form.str('image', 1000),
        photo: form.str('photo', 40),
      });
      return 'vb-saved';
    case 'delete':
      await deleteTile(person, id);
      return 'vb-deleted';
    case 'up':
    case 'down':
      await moveTile(person, id, form.str('action', 20) as 'up' | 'down');
      return 'lv-moved';
    default:
      throw new UserError('Unknown action.');
  }
});
