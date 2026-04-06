export function useImageHelper(path: string): string {
    console.log(import.meta.glob);
    if (!import.meta?.glob) return "";
    const assets = import.meta.glob('~/assets/img/**/*', {
        eager: true,
        import: 'default',
    });
    return assets[`/assets/img/${path}`];
}