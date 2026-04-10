interface UndoAction {
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export class UndoStack {
  private stack: UndoAction[] = [];
  private pointer = -1;
  private maxSize = 50;

  push(action: UndoAction) {
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(action);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    } else {
      this.pointer++;
    }
  }

  async undo(): Promise<boolean> {
    if (this.pointer < 0) return false;
    await this.stack[this.pointer].undo();
    this.pointer--;
    return true;
  }

  async redo(): Promise<boolean> {
    if (this.pointer >= this.stack.length - 1) return false;
    this.pointer++;
    await this.stack[this.pointer].redo();
    return true;
  }

  get canUndo() {
    return this.pointer >= 0;
  }

  get canRedo() {
    return this.pointer < this.stack.length - 1;
  }
}
