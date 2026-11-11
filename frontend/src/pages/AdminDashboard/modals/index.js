import { openAsset, confirmDelete, deleteAsset } from './assets';
import { buildScheduleHTML, wireScheduleEvents, openSchedule, scheduleState } from './schedule';
import { openRequest, markCompleted, openComplete, openNewRequest, deleteRequest } from './requests';

export {
  openAsset,
  confirmDelete,
  deleteAsset,
  buildScheduleHTML,
  wireScheduleEvents,
  openSchedule,
  scheduleState,
  openRequest,
  markCompleted,
  openComplete,
  openNewRequest,
  deleteRequest,
};

export function createModals(ctx) {
  const modals = {
    openAsset: (id) => openAsset(ctx, id),
    confirmDelete: (title, message, onConfirm) => confirmDelete(ctx, title, message, onConfirm),
    deleteAsset: (id) => deleteAsset(ctx, id),
    buildScheduleHTML: (activeDate, activeDept) => buildScheduleHTML(ctx, activeDate, activeDept),
    wireScheduleEvents: (container) => wireScheduleEvents(ctx, container),
    openSchedule: (activeDate, activeDept) => openSchedule(ctx, activeDate, activeDept),
    openRequest: (id) => openRequest(ctx, id),
    markCompleted: (r, doneDate, actual, note) => markCompleted(ctx, r, doneDate, actual, note),
    openComplete: (id) => openComplete(ctx, id),
    openNewRequest: () => openNewRequest(ctx),
    deleteRequest: (id) => deleteRequest(ctx, id),
  };
  return modals;
}
