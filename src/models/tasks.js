class Task {
  constructor({ id, title, status = 'todo', priority = 'Medium', deadline = null, tags = [], boardId = 'board-1' }) {
    this.id = id || Date.now();
    this.title = title;
    this.status = status; // todo, in-progress, done
    this.priority = priority; // Low, Medium, High
    this.deadline = deadline;
    this.tags = tags;
    this.boardId = boardId;
    this.createdAt = new Date().toISOString();
  }
}

module.exports = Task;