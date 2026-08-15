import React from 'react';
import { X, Grid, Check } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ConfigureColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueTableColumns: any[];
  setIssueTableColumns: React.Dispatch<React.SetStateAction<any[]>>;
  handleReorderColumns: (result: any) => void;
}

export const ConfigureColumnsModal: React.FC<ConfigureColumnsModalProps> = ({
  isOpen,
  onClose,
  issueTableColumns,
  setIssueTableColumns,
  handleReorderColumns
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface rounded-xl w-full max-w-lg shadow-xl relative my-auto overflow-hidden flex flex-col border border-border-subtle"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-surface">
            <h2 className="text-sm font-semibold text-content">Configure Columns</h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-content-subtle hover:text-content-secondary hover:bg-surface-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto max-h-[60vh] text-xs">
            <div className="space-y-3">
              <p className="text-xs text-content-muted font-medium">Drag to reorder and toggle visibility of columns.</p>
              <DragDropContext onDragEnd={handleReorderColumns}>
                <Droppable droppableId="columns">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-1.5 max-h-[380px] overflow-y-auto px-1"
                    >
                      {issueTableColumns.map((col, index) => (
                        <Draggable key={col.id} draggableId={col.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "flex items-center justify-between p-2.5 bg-surface-sunken/80 rounded-md hover:bg-surface-muted/80 transition-colors group border border-border-subtle/60",
                                snapshot.isDragging ? "shadow-md bg-surface border-primary/40 z-[70]" : ""
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-content-subtle hover:text-content-secondary">
                                   <Grid className="w-4 h-4" />
                                </div>
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                  <div 
                                    onClick={() => {
                                      setIssueTableColumns(prev => prev.map(c => c.id === col.id ? { ...c, visible: !c.visible } : c));
                                    }}
                                    className={cn(
                                      "w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer",
                                      col.visible ? "bg-primary border-primary" : "bg-surface border-slate-300"
                                    )}
                                  >
                                    {col.visible && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="text-xs font-medium text-content-strong">{col.label}</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>
          
          <div className="px-5 py-3.5 border-t border-border-faint flex justify-end items-center gap-2 bg-surface-sunken/50">
            <button 
              onClick={onClose}
              className="px-4 py-2 font-medium bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md transition-all text-xs shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
