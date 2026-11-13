# Open R in this extracted folder, then source("reproduce.R").
# Recompute the PCA and clustering, check them, and rebuild the captured figure.
packages <- c("jsonlite", "cluster")
missing <- setdiff(packages, rownames(installed.packages()))
if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")

settings <- jsonlite::fromJSON("settings.json")
reference <- jsonlite::fromJSON("analysis_reference.json")
if (!identical(settings$pca_available, FALSE)) {
x <- as.matrix(read.csv("data_used.csv", check.names = FALSE))
weights <- unlist(settings$effective_weights)[colnames(x)]
stopifnot(ncol(x) >= 3, all(is.finite(x)), all(is.finite(weights)), all(weights > 0))
stopifnot(!any(settings$excluded_features %in% colnames(x)))

# Use the exported, already-coded values: no second parsing or imputation step.
z <- sweep(scale(x), 2, sqrt(weights), "*")
pca <- prcomp(z, center = FALSE, scale. = FALSE)
# PCA signs are arbitrary. Align with the browser to preserve the displayed axes.
rotation_reference <- t(reference$loadings)
for (j in seq_len(ncol(pca$rotation))) {
  if (sum(pca$rotation[, j] * rotation_reference[, j]) < 0) {
    pca$rotation[, j] <- -pca$rotation[, j]
    pca$x[, j] <- -pca$x[, j]
  }
}
explained <- 100 * pca$sdev^2 / sum(pca$sdev^2)
number_pcs <- max(2L, which(cumsum(explained) >= settings$variance_target - 1e-9)[1])
distance <- dist(pca$x[, seq_len(number_pcs), drop = FALSE])
tree <- hclust(distance, method = "ward.D2")
clusters <- cutree(tree, k = settings$k)
silhouette <- mean(cluster::silhouette(clusters, distance)[, "sil_width"])
score_error <- max(abs(pca$x[, seq_len(number_pcs), drop = FALSE] - reference$scores[, seq_len(number_pcs), drop = FALSE]))
partition_matches <- nrow(unique(data.frame(R = clusters, browser = reference$clusters))) == settings$k
stopifnot(number_pcs == settings$n_pcs, score_error < 1e-6, partition_matches)
if (!is.null(reference$merge_heights)) stopifnot(max(abs(tree$height - reference$merge_heights)) < 1e-6)

write.csv(data.frame(article_id = seq_len(nrow(x)), pca$x, cluster = clusters), "recomputed_scores.csv", row.names = FALSE)
write.csv(data.frame(feature = rownames(pca$rotation), pca$rotation), "recomputed_loadings.csv", row.names = FALSE)
write.csv(data.frame(component = seq_along(explained), explained_percent = explained, cumulative_percent = cumsum(explained)), "recomputed_variance.csv", row.names = FALSE)
pdf("recomputed_hierarchy.pdf", width = 10, height = 6)
plot(tree, labels = seq_len(nrow(x)), main = paste("Ward.D2, k =", settings$k), xlab = "Article ID", sub = "")
rect.hclust(tree, k = settings$k, border = seq_len(settings$k) + 1)
dev.off()
cat(sprintf("Verified: %d features; %d PCs; k=%d; silhouette %.6f; max score difference %.3g\n", ncol(x), number_pcs, settings$k, silhouette, score_error))

}
if (file.exists("rebuild_tables.R")) source("rebuild_tables.R")

# The saved specification preserves the figure's traces, overlays, zoom, dimensions
# and (for 3D) camera. It is rendered only after the numerical checks above pass.
snapshot <- jsonlite::fromJSON("figure.json", simplifyVector = FALSE)
if (identical(snapshot$kind, "plotly")) {
  missing <- setdiff(c("plotly", "htmlwidgets"), rownames(installed.packages()))
  if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")
  figure <- plotly::plotly_build(list(data = snapshot$data, layout = snapshot$layout))
  if (!is.null(snapshot$config)) figure$x$config <- snapshot$config
  # Pin the same JavaScript renderer used by the browser image.
  if (file.exists("plotly_renderer.min.js")) {
    figure$dependencies <- lapply(figure$dependencies, function(dependency) {
      if (identical(dependency$name, "plotly-main")) {
        htmltools::htmlDependency("plotly-main", settings$renderer_version,
          src = c(file = getwd()), script = "plotly_renderer.min.js", all_files = FALSE)
      } else dependency
    })
  }
  htmlwidgets::saveWidget(figure, "reproduced_figure.html", selfcontained = FALSE)
  if (interactive()) print(figure)
} else if (identical(snapshot$kind, "svg")) {
  writeLines('<!doctype html><meta charset="utf-8"><title>Captured hierarchy</title><img src="current_figure.svg" style="max-width:100%">', "reproduced_figure.html")
} else if (identical(snapshot$kind, "table")) {
  file.copy("tables.html", "reproduced_figure.html", overwrite = TRUE)
} else {
  writeLines("<!doctype html><meta charset=\"utf-8\"><p>No figure was visible during this full-app export. The captured PCA was recomputed and verified.</p>", "reproduced_figure.html")
}
if (file.exists("current_figure.png")) cat("Exact browser PNG/SVG: current_figure.png / current_figure.svg.\n")
cat("R-rendered interactive figure: reproduced_figure.html. Fonts and Plotly versions can affect rendering; the original PNG/SVG is the visual reference.\n")
