import { UserError } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';
import { addItem, deleteItem, editItem, moveItem, saveVision2029, toggleItem, type ListName } from '../../../lib/life/lifevision';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const id = form.str('id', 40);
  switch (form.str('action', 20)) {
    case 'add':
      await addItem(person, form.str('list', 10) as ListName, form.str('text', 500));
      return 'lv-added';
    case 'edit':
      await editItem(person, id, form.str('text', 500));
      return 'lv-saved';
    case 'toggle':
      return (await toggleItem(person, id)) ? 'lv-done' : 'lv-undone';
    case 'delete':
      await deleteItem(person, id);
      return 'lv-deleted';
    case 'up':
    case 'down':
      await moveItem(person, id, form.str('action', 20) as 'up' | 'down');
      return 'lv-moved';
    case 'vision2029':
      await saveVision2029(person, form.str('body', 12000), form.str('question', 500));
      return 'lv-vision';
    default:
      throw new UserError('Unknown action.');
  }
});
