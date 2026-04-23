interface TaskNode {
    id: string;
    description: string;
    dependencies: string[];
}

export function validate_dag(tasks: TaskNode[]): { valid: boolean; cycle?: string[] } {
    const graph = new Map<string, Set<string>>();
    const ids = new Set(tasks.map((t) => t.id));

    for (const task of tasks) {
        if (!graph.has(task.id)) {
            graph.set(task.id, new Set());
        }
        for (const dep of task.dependencies) {
            if (!ids.has(dep)) {
                return { valid: false, cycle: [dep] };
            }
            graph.get(task.id)?.add(dep);
        }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(node: string, path: string[]): boolean {
        visited.add(node);
        recursionStack.add(node);

        const deps = graph.get(node) ?? new Set();
        for (const dep of deps) {
            if (!visited.has(dep)) {
                if (dfs(dep, path)) {
                    return true;
                }
            } else if (recursionStack.has(dep)) {
                path.push(dep);
                return true;
            }
        }

        recursionStack.delete(node);
        return false;
    }

    for (const id of ids) {
        if (!visited.has(id)) {
            const path: string[] = [];
            if (dfs(id, path)) {
                return { valid: false, cycle: path };
            }
        }
    }

    return { valid: true };
}

export function topological_sort(tasks: TaskNode[]): TaskNode[] {
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const taskMap = new Map<string, TaskNode>();

    for (const task of tasks) {
        graph.set(task.id, new Set());
        inDegree.set(task.id, 0);
        taskMap.set(task.id, task);
    }

    for (const task of tasks) {
        for (const dep of task.dependencies) {
            if (graph.has(dep)) {
                graph.get(dep)?.add(task.id);
                inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
            }
        }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0) {
            queue.push(id);
        }
    }

    const result: TaskNode[] = [];
    while (queue.length > 0) {
        const id = queue.shift() ?? '';
        const task = taskMap.get(id);
        if (task) {
            result.push(task);
        }

        const dependents = graph.get(id) ?? new Set();
        for (const dependent of dependents) {
            const newDegree = (inDegree.get(dependent) ?? 0) - 1;
            inDegree.set(dependent, newDegree);
            if (newDegree === 0) {
                queue.push(dependent);
            }
        }
    }

    if (result.length !== tasks.length) {
        throw new Error('Cycle detected in task graph');
    }

    return result;
}
