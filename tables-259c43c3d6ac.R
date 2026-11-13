# Rebuild analytical tables from captured inputs; preserve descriptive source text.
# This file is also usable directly: source("rebuild_tables.R").
if (!requireNamespace("jsonlite", quietly = TRUE)) install.packages("jsonlite", repos = "https://cloud.r-project.org")
if (!requireNamespace("cluster", quietly = TRUE)) install.packages("cluster", repos = "https://cloud.r-project.org")
settings <- jsonlite::fromJSON("settings.json")
input <- jsonlite::fromJSON("tables_input.json")
table_state <- jsonlite::fromJSON("table_settings.json")
controls <- table_state$controls
expected <- jsonlite::fromJSON("tables_reference.json", simplifyVector = FALSE)
reference <- jsonlite::fromJSON("analysis_reference.json")
all_data <- as.matrix(read.csv("data_all.csv", check.names = FALSE))
n <- nrow(all_data)
features <- input$features
articles <- input$articles
label <- setNames(features$label, features$key)
dir.create("recomputed_tables", showWarnings = FALSE)
js_round <- function(x) floor(x + .5)
# Compare each cell before writing. CSV strings stay intact; numerical tolerance
# allows browser floating-point arithmetic and the browser's chi-square approximation.
write_table <- function(key, rows) {
  target <- expected[[key]]
  stopifnot(!is.null(target))
  cols <- unlist(target$columns)
  if (is.null(dim(rows))) rows <- matrix(rows, ncol = length(cols), byrow = TRUE)
  if (is.data.frame(rows)) {
    rows[] <- lapply(rows,function(column) if (is.list(column)) vapply(column,function(cell) if (length(cell)) as.character(cell) else "", character(1)) else column)
    rows <- as.matrix(rows)
  }
  if (!length(rows)) rows <- matrix(character(), 0, length(cols))
  stopifnot(nrow(rows) == length(target$rows), ncol(rows) == length(cols))
  text <- function(x) {if (is.null(x) || !length(x) || is.na(x)) "" else if (is.logical(x)) tolower(as.character(x)) else as.character(x)}
  for (i in seq_len(nrow(rows))) for (j in seq_len(ncol(rows))) {
    actual <- text(rows[i,j]); wanted <- text(target$rows[[i]][[j]])
    if (wanted %in% c("true","false") && actual %in% c("0","1")) actual <- if (actual=="1") "true" else "false"
    a <- suppressWarnings(as.numeric(actual)); b <- suppressWarnings(as.numeric(wanted))
    equal <- if (!is.na(a) && !is.na(b)) abs(a-b) <= 1e-6 * max(1,abs(b)) else identical(tolower(actual),tolower(wanted))
    if (!equal) stop(sprintf("Table %s differs at row %d, column %s: %s vs %s", key, i, cols[j], actual, wanted))
  }
  colnames(rows) <- cols
  write.csv(rows, file.path("recomputed_tables", paste0(key,".csv")), row.names = FALSE, na = "")
  invisible(rows)
}
write_matrix <- function(key, matrix, keys) {
  order <- table_state$orders[[key]]
  if (!is.null(order)) {order <- order+1L; matrix <- matrix[order,order,drop=FALSE]; keys <- keys[order]}
  write_table(key,cbind(keys,matrix))
}
keys <- features$key[features$binary & features$group != "continuous"]
m <- all_data[,keys,drop=FALSE]
counts <- crossprod(m); own <- diag(counts); p <- own/n
write_table("feature_matrix",cbind(articles$id,m))
write_table("feature_statistics",cbind(keys,label[keys],own,p,p*(1-p),keys %in% settings$ticked_features,keys %in% settings$features_used))
write_matrix("cooccurrence",counts,keys)
traits <- features$key[features$group=="traits" & features$binary]
write_matrix("trait_correlations",cor(all_data[,traits,drop=FALSE]),traits)
if (!is.null(expected$variable_correlations)) {
  cf <- features$key[features$group %in% controls$correlation_groups]
  cf <- cf[apply(all_data[,cf,drop=FALSE],2,sd)>0]
  write_matrix("variable_correlations",cor(all_data[,cf,drop=FALSE]),cf)
}
write_matrix("clustered_cooccurrence",counts,keys)
shares <- sweep(counts,1,ifelse(own==0,1,own),"/")
write_matrix("row_share",shares,keys)
den <- sqrt(outer(p*(1-p),p*(1-p)))
phi <- (counts/n-outer(p,p))/den; phi[den==0] <- 0; diag(phi) <- NA
write_matrix("phi",phi,keys)
lift <- log2((counts+.5)/(outer(own,own)/n+.5)); diag(lift) <- NA
write_matrix("lift",lift,keys)
a <- controls$feature_a; b <- controls$feature_b
if (a %in% colnames(all_data) && b %in% colnames(all_data)) {
  cross <- table(factor(all_data[,a],levels=0:1),factor(all_data[,b],levels=0:1))
  rs <- rowSums(cross); cs <- colSums(cross); den <- prod(rs)*prod(cs)
  chi <- if (den>0) n*max(abs(cross[1,1]*cross[2,2]-cross[1,2]*cross[2,1])-n/2,0)^2/den else NA
  ph <- if (den>0) (cross[1,1]*cross[2,2]-cross[1,2]*cross[2,1])/sqrt(den) else NA
  write_table("cross_counts",rbind(cbind(0:1,cross,rs),c("total",cs,n)))
  ev <- outer(rs,cs)/n
  write_table("cross_statistics",cbind(c("n","chi_square_yates","p_value","phi","expected_00","expected_01","expected_10","expected_11"),c(n,chi,pchisq(chi,1,lower.tail=FALSE),ph,as.vector(t(ev)))))
  both <- all_data[,a]==1 & all_data[,b]==1
  write_table("cross_articles",articles[both,c("id","authors","title","year"),drop=FALSE])
}
# Raw text and summary-map coding are source metadata, not inferred variables.
raw <- as.matrix(input$raw)
write_table("workbook",cbind(articles$id,raw))
q <- tolower(controls$search)
keep <- apply(raw,1,function(row) any(grepl(q,tolower(ifelse(is.na(row),"",row)),fixed=TRUE)))
write_table("workbook_filtered",cbind(articles$id[keep],raw[keep,,drop=FALSE]))
# Dictionary roles/feeds are structured strings in the source snapshot.
raw_input <- jsonlite::fromJSON("tables_input.json", simplifyVector=FALSE)
dict_rows <- lapply(raw_input$dict,function(d) c(d$col,d$name,d$full,jsonlite::toJSON(d$roles,auto_unbox=TRUE),jsonlite::toJSON(d$feeds,auto_unbox=TRUE)))
write_table("dictionary",do.call(rbind,dict_rows))
# Citation neighbourhood is undirected for browsing; edges retain citing -> cited direction.
edges <- as.matrix(input$edges); edges <- edges[edges[,1]>=1 & edges[,2]>=1 & edges[,1]<=n & edges[,2]<=n,,drop=FALSE]
incoming <- tabulate(edges[,2],nbins=n); outgoing <- tabulate(edges[,1],nbins=n)
visible <- which(incoming+outgoing>0)
if (controls$citation_scope=="focus") {
  visible <- controls$citation_focus+1L; front <- visible
  for (depth in seq_len(controls$citation_depth)) {
    neighbours <- unique(c(edges[edges[,1] %in% front,2],edges[edges[,2] %in% front,1]))
    front <- setdiff(neighbours,visible); visible <- union(visible,front)
  }
}
edge_rows <- function(e) cbind(articles$id[e[,1]],articles$id[e[,2]],articles$title[e[,1]],articles$title[e[,2]])
write_table("citation_all_edges",edge_rows(edges))
write_table("citation_edges",edge_rows(edges[edges[,1] %in% visible & edges[,2] %in% visible,,drop=FALSE]))
# Use the captured hierarchy orientation for split labels. R independently verifies
# its Ward heights/partition in reproduce.R; tied branches may rotate in hclust.
pca_available <- !identical(settings$pca_available,FALSE)
clusters <- if (pca_available) reference$clusters else rep(1,n)
k <- if (pca_available) settings$k else 1
write_table("citation_nodes",cbind(articles$id,incoming,outgoing,incoming+outgoing,seq_len(n) %in% visible,clusters))
cm <- table(factor(clusters[edges[,1]],levels=seq_len(k)),factor(clusters[edges[,2]],levels=seq_len(k)))
write_matrix("citation_counts",cm,paste0("C",seq_len(k)))
write_matrix("citation_share",sweep(cm,1,pmax(rowSums(cm),1),"/"),paste0("C",seq_len(k)))
if (pca_available) {
  x <- all_data[,settings$features_used,drop=FALSE]
  z <- sweep(scale(x),2,sqrt(unlist(settings$effective_weights)[colnames(x)]),"*")
  fit <- prcomp(z,center=FALSE,scale.=FALSE)
  for (j in seq_len(ncol(fit$rotation))) if (sum(fit$rotation[,j]*reference$loadings[j,])<0) {fit$rotation[,j] <- -fit$rotation[,j]; fit$x[,j] <- -fit$x[,j]}
  # A zero-variance PCA subspace has no unique basis. Verify the saved basis
  # against the covariance matrix, then retain it for reproducible loadings.
  zero <- which(fit$sdev^2 < max(fit$sdev^2)*1e-10)
  if (length(zero)) {
    basis <- t(reference$loadings)[,zero,drop=FALSE]
    stopifnot(max(abs(crossprod(z)%*%basis/(n-1)))<1e-6,
              max(abs(crossprod(basis)-diag(length(zero))))<1e-6)
    fit$rotation[,zero] <- basis; fit$x[,zero] <- z%*%basis
  }
  exp <- 100*fit$sdev^2/sum(fit$sdev^2)
  write_table("scores",cbind(articles$id,clusters,fit$x))
  write_table("loadings",cbind(colnames(x),fit$rotation))
  write_table("variance",cbind(seq_along(exp),exp,cumsum(exp),seq_along(exp)<=settings$n_pcs))
  distance <- dist(fit$x[,seq_len(settings$n_pcs),drop=FALSE])
  merges <- reference$merges
  node <- function(id) ifelse(id<n,-id-1,id-n+1)
  tree <- structure(list(merge=cbind(node(merges$a),node(merges$b)),height=merges$height,order=seq_len(n),labels=as.character(seq_len(n)),method="ward.D2",call=match.call(),dist.method="euclidean"),class="hclust")
  ks <- 2:12
  bin <- intersect(colnames(x),features$key[features$binary])
  prevalence <- function(ids) colMeans(all_data[ids,bin,drop=FALSE])
  contrast <- function(ids,rest,number) {
    differences <- 100*(prevalence(ids)-prevalence(rest)); order <- order(-abs(differences),seq_along(bin)); order <- head(order,number)
    paste(paste0(label[bin[order]]," ",ifelse(differences[order]>=0,"+",""),js_round(differences[order])," pp"),collapse=", ")
  }
  sil <- cluster::silhouette(clusters,distance)[,"sil_width"]
  summary <- list(); profiles <- list()
  for (c in seq_len(settings$k)) {
    ids <- which(clusters==c); rest <- which(clusters!=c); p <- prevalence(ids); top <- head(order(-p,seq_along(bin)),3)
    summary[[c]] <- c(c,length(ids),100*length(ids)/n,mean(sil[ids]),sum(articles$model[ids]),paste(paste0(label[bin[top]]," ",js_round(100*p[top]),"%"),collapse=", "),contrast(ids,rest,2))
    profiles[[c]] <- cbind(c,bin,p,prevalence(rest),100*(p-prevalence(rest)))
  }
  write_table("cluster_summary",do.call(rbind,summary));write_table("cluster_profiles",do.call(rbind,profiles))
  leaves <- function(id) if (id<n) id+1L else c(leaves(merges$b[id-n+1]),leaves(merges$a[id-n+1]))
  splits <- lapply(ks,function(k) {q <- n-k+1; a <- leaves(merges$a[q]);b <- leaves(merges$b[q]); lab <- cutree(tree,k);c(k,length(a)+length(b),lab[a[1]],length(a),lab[b[1]],length(b),merges$height[q],contrast(a,b,3))})
  write_table("splits",do.call(rbind,splits))
}
# Reproduce the browser's unweighted three-step screening; this does not change
# selections or the PCA weights captured above.
pool <- if (settings$scope=="all") colnames(all_data) else input$scopes[[settings$scope]]
pool <- setdiff(pool,settings$excluded_features)
v <- all_data[,pool,drop=FALSE]; means <- colMeans(v)
binary <- apply(v,2,function(x) all(x %in% 0:1)); constant <- apply(v,2,function(x) length(unique(x))<2)
prevalence <- ifelse(binary,100*means,NA)
maxr <- comm <- rep(NA,length(pool)); similar <- reason <- rep("",length(pool)); decision <- rep("IN",length(pool))
for (i in seq_along(pool)) {
  if (constant[i]) {decision[i] <- "OUT";reason[i] <- "constant"}
  else if (binary[i] && (prevalence[i]<controls$prevalence_min || prevalence[i]>100-controls$prevalence_min)) {
    decision[i] <- "OUT"; reason[i] <- sprintf("prevalence %d%% outside %d-%d%% (fewer than ~%d articles in the minority class)",js_round(prevalence[i]),controls$prevalence_min,100-controls$prevalence_min,ceiling(n*controls$prevalence_min/100))
  }
}
alive <- which(decision=="IN")
if (length(alive)>1) {
  importance <- ifelse(binary,means*(1-means),.25); ordered <- alive[order(-importance[alive],seq_along(alive))]
  correlations <- abs(cor(v[,ordered,drop=FALSE])); kept <- integer()
  for (i in ordered) {
    if (length(kept)) {
      r <- correlations[match(i,ordered),match(kept,ordered)]; best <- which.max(r)
      maxr[i] <- round(r[best],2);similar[i] <- label[pool[kept[best]]]
      if (r[best]>=controls$correlation_max) {decision[i] <- "OUT";reason[i] <- sprintf("duplicates %s (|r| = %.2f)",similar[i],r[best]);next}
    }
    kept <- c(kept,i)
  }
  alive <- kept
}
if (length(alive)>=4) {
  fit <- prcomp(v[,alive,drop=FALSE],scale.=TRUE); npc <- max(2,which(cumsum(fit$sdev^2)/sum(fit$sdev^2)>=.70)[1])
  values <- rowSums(sweep(fit$rotation[,seq_len(npc),drop=FALSE]^2,2,fit$sdev[seq_len(npc)]^2,"*"))
  for (j in seq_along(alive)) {i <- alive[j];comm[i] <- round(values[j],2);if (values[j]<controls$communality_min) {decision[i] <- "OUT";reason[i] <- sprintf("communality %.2f < %.2f on the %d PCs covering 70%% of the variance (poorly represented)",values[j],controls$communality_min,npc)}}
}
reason[decision=="IN"] <- "passes all three checks"
category <- input$group_titles[features$group[match(pool,features$key)]]
write_table("screening",cbind(pool,label[pool],unlist(category),ifelse(binary,"0/1","number"),round(prevalence,1),maxr,similar,comm,decision,reason,pool %in% settings$ticked_features))
cat(sprintf("Verified and rebuilt all %d captured tables in recomputed_tables/.\n",length(expected)))
