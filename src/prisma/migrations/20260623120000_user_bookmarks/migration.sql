-- CreateTable
CREATE TABLE "_UserBookmarks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserBookmarks_AB_unique" ON "_UserBookmarks"("A", "B");

-- CreateIndex
CREATE INDEX "_UserBookmarks_B_index" ON "_UserBookmarks"("B");

-- AddForeignKey
ALTER TABLE "_UserBookmarks" ADD FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserBookmarks" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
