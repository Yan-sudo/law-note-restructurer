import { TFile, TFolder, Vault } from "obsidian";

/**
 * After generating pages for a course, scan sibling course folders
 * for pages with the same name and add "See also" cross-links in both directions.
 */

const CROSS_LINK_BEGIN = "<!-- cross-course-links-begin -->";
const CROSS_LINK_END = "<!-- cross-course-links-end -->";
const CROSS_LINK_RE =
    /<!-- cross-course-links-begin -->[\s\S]*?<!-- cross-course-links-end -->/g;

/** Subfolder names that contain linkable entity pages */
const ENTITY_FOLDERS = ["Concepts", "Cases", "Regulations"];

interface CrossMatch {
    /** The page in the current course */
    currentFile: TFile;
    /** Pages in other courses with the same basename */
    otherFiles: TFile[];
}

/**
 * Add cross-course "See also" links for all entity pages in `courseName`.
 *
 * @param vault       Obsidian vault
 * @param baseFolder  The root output folder (e.g. "LawNotes/Generated")
 * @param courseName  Current course name (e.g. "PIT")
 */
export async function addCrossCourseLinks(
    vault: Vault,
    baseFolder: string,
    courseName: string
): Promise<number> {
    const siblingCourses = getSiblingCourses(vault, baseFolder, courseName);
    if (siblingCourses.length === 0) return 0;

    let linkCount = 0;

    for (const subfolder of ENTITY_FOLDERS) {
        const currentFolder = `${baseFolder}/${courseName}/${subfolder}`;
        const currentDir = vault.getAbstractFileByPath(currentFolder);
        if (!(currentDir instanceof TFolder)) continue;

        // Collect current course's pages in this subfolder
        const currentPages = currentDir.children.filter(
            (f): f is TFile => f instanceof TFile && f.extension === "md"
        );

        for (const page of currentPages) {
            // Find same-named pages in sibling courses
            const otherFiles: TFile[] = [];

            for (const sibling of siblingCourses) {
                const otherPath = `${baseFolder}/${sibling}/${subfolder}/${page.name}`;
                const otherFile = vault.getAbstractFileByPath(otherPath);
                if (otherFile instanceof TFile) {
                    otherFiles.push(otherFile);
                }
            }

            if (otherFiles.length === 0) continue;

            // Build cross-link section for the current page
            const allRelated = otherFiles.map((f) => ({
                file: f,
                course: extractCourseName(f.path, baseFolder),
            }));

            await updateCrossLinks(vault, page, allRelated);

            // Also update each sibling page to link back to the current page
            for (const otherFile of otherFiles) {
                // Gather ALL related pages for this sibling (including current + other siblings)
                const relatedToOther: { file: TFile; course: string }[] = [
                    { file: page, course: courseName },
                ];
                // Add other siblings that also share this name
                for (const otherFile2 of otherFiles) {
                    if (otherFile2.path !== otherFile.path) {
                        relatedToOther.push({
                            file: otherFile2,
                            course: extractCourseName(otherFile2.path, baseFolder),
                        });
                    }
                }
                await updateCrossLinks(vault, otherFile, relatedToOther);
            }

            linkCount += otherFiles.length;
        }
    }

    return linkCount;
}

/** Get all course folder names under baseFolder, excluding the current one */
function getSiblingCourses(
    vault: Vault,
    baseFolder: string,
    currentCourse: string
): string[] {
    const folder = vault.getAbstractFileByPath(baseFolder);
    if (!(folder instanceof TFolder)) return [];

    return folder.children
        .filter(
            (child): child is TFolder =>
                child instanceof TFolder && child.name !== currentCourse
        )
        .map((f) => f.name);
}

/** Extract the course name from a file path like "LawNotes/Generated/PIT/Concepts/Foo.md" */
function extractCourseName(filePath: string, baseFolder: string): string {
    const relative = filePath.slice(baseFolder.length + 1); // "PIT/Concepts/Foo.md"
    return relative.split("/")[0];
}

/** Build and insert/update the cross-link section in a page */
async function updateCrossLinks(
    vault: Vault,
    file: TFile,
    related: { file: TFile; course: string }[]
): Promise<void> {
    if (related.length === 0) return;

    const content = await vault.read(file);

    // Build the cross-link section
    const links = related
        .map((r) => {
            // Use path without .md extension for wikilink
            const linkTarget = r.file.path.replace(/\.md$/, "");
            return `> - [[${linkTarget}|${r.course}]]`;
        })
        .join("\n");

    const section = [
        CROSS_LINK_BEGIN,
        "> [!tip] Also in / 另见",
        links,
        CROSS_LINK_END,
    ].join("\n");

    // Replace existing section or append
    let newContent: string;
    if (CROSS_LINK_RE.test(content)) {
        // Reset regex state
        CROSS_LINK_RE.lastIndex = 0;
        newContent = content.replace(CROSS_LINK_RE, section);
    } else {
        newContent = content.trimEnd() + "\n\n" + section + "\n";
    }

    if (newContent !== content) {
        await vault.modify(file, newContent);
    }
}
