import { UserError } from '../../../lib/life/actions';
import {
  addComment,
  addLink,
  checklistAction,
  createCard,
  deleteCard,
  deleteComment,
  editComment,
  makeTop3,
  moveCard,
  removeLink,
  restoreCard,
  saveDetails,
  toggleComplete,
} from '../../../lib/life/board';
import { personForEmail } from '../../../lib/life/env';
import { formRoute, type Form } from '../../../lib/life/http';

export const prerender = false;

const index = (form: Form, name: string) => {
  const n = form.num(name);
  if (n === null || !Number.isInteger(n) || n < 0) throw new UserError('Something in the form was off. Refresh and try again.');
  return n;
};

export const POST = formRoute(async (form, ctx) => {
  // Each person only ever works on their own board.
  const session = ctx.locals.session!;
  const owner = personForEmail(session.email);
  const id = form.str('card', 40);
  const action = form.str('action', 30);

  switch (action) {
    case 'create':
      await createCard(owner, form.str('list', 20), form.str('title', 500));
      return 'card-added';
    case 'details':
      await saveDetails(owner, id, {
        title: form.str('title', 500),
        desc: form.str('desc', 20000),
        labels: form.all('labels'),
        start: form.str('start', 10),
        due: form.str('due', 10),
        dueTime: form.str('dueTime', 5),
        dueDone: form.str('dueDone', 5) === 'Yes',
        fy: form.str('fy', 40),
        waiting: form.str('waiting', 120),
      });
      return 'card-saved';
    case 'move':
      await moveCard(owner, id, form.str('list', 20), form.num('pos'));
      return 'card-moved';
    case 'archive':
      await moveCard(owner, id, 'archive');
      return 'card-archived';
    case 'restore':
      await restoreCard(owner, id);
      return 'card-restored';
    case 'complete':
      await toggleComplete(owner, id);
      return 'card-saved';
    case 'delete':
      if (form.str('confirm', 10) !== 'yes') throw new UserError('Tick the box to confirm deleting the card.');
      await deleteCard(owner, id);
      return 'card-deleted';
    case 'add-list':
      await checklistAction(owner, id, 'add-list', { text: form.str('text', 200) });
      return 'checklist';
    case 'delete-list':
      await checklistAction(owner, id, 'delete-list', { list: index(form, 'list') });
      return 'checklist';
    case 'add-item':
    case 'toggle-item':
    case 'delete-item':
    case 'edit-item':
      await checklistAction(owner, id, action, {
        list: index(form, 'list'),
        item: action === 'add-item' ? undefined : index(form, 'item'),
        text: form.str('text', 1000),
      });
      return action === 'toggle-item' ? 'item-toggled' : 'checklist';
    case 'add-link':
      await addLink(owner, id, form.str('url', 2000), form.str('name', 200));
      return 'link';
    case 'remove-link':
      await removeLink(owner, id, index(form, 'index'));
      return 'link';
    case 'comment':
      await addComment(owner, id, (session.name || owner).split(' ')[0], form.str('text', 10000));
      return 'comment';
    case 'edit-comment':
      await editComment(owner, form.str('comment', 40), form.str('text', 10000));
      return 'comment';
    case 'delete-comment':
      await deleteComment(owner, form.str('comment', 40));
      return 'comment-deleted';
    case 'top3': {
      const n = await makeTop3(owner, id);
      return n > 3 ? 'top3-bonus' : 'top3-added';
    }
    default:
      throw new UserError('Unknown action.');
  }
});
