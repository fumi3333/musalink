
export function extractStudentId(email: string): string | null {
    const match = email.match(/^([a-zA-Z0-9]+)@stu\.musashino-u\.ac\.jp$/);
    return match ? match[1] : null;
}
