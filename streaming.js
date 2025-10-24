// --- API Configuration ---
const API_KEY = '210d6a5dd3f16419ce349c9f1b200d6d'; // Public TMDB read-only key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const STREAM_BASE_URLS = {
    movie: 'https://vidsrc.xyz/embed/movie?tmdb=',
    tv: 'https://vidsrc.xyz/embed/tv?tmdb='
};

// --- DOM Elements ---
const mainContent = document.getElementById('main-content');
const mediaGrid = document.getElementById('media-grid');
const searchInput = document.getElementById('search-input');
const pageTitle = document.getElementById('page-title');
const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menu-button');
const homeLogoButton = document.getElementById('home-logo-button');
const infiniteLoader = document.getElementById('infinite-loader');
const genreDropdownBtn = document.getElementById('genre-dropdown-btn');
const genreList = document.getElementById('genre-list');
const genreArrow = document.getElementById('genre-arrow');
const overlay = document.getElementById('overlay');
const watchPage = document.getElementById('watch-page');
const watchIframe = document.getElementById('watch-iframe');
const mediaDetails = document.getElementById('media-details');
const recommendationsGrid = document.getElementById('recommendations-grid');
const recommendationTitle = document.getElementById('recommendation-title');
const tvSeasonSelector = document.getElementById('tv-season-selector');

// --- App State ---
let currentPage = 1, totalPages = 1, currentApiUrl = '', currentMediaType = 'movie', isLoading = false;

// --- API & View Management ---
function getFullApiUrl(baseUrl, page = 1) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}api_key=${API_KEY}&page=${page}`;
}

async function fetchMedia(url, title, mediaType) {
    showGridView();
    mediaGrid.innerHTML = `<div class="col-span-full h-96 flex items-center justify-center"><div class="loader"></div></div>`;
    pageTitle.textContent = title;
    currentPage = 1;
    currentApiUrl = url;
    currentMediaType = mediaType;
    try {
        const fullUrl = getFullApiUrl(currentApiUrl, currentPage);
        const res = await fetch(fullUrl);
        const data = await res.json();
        totalPages = data.total_pages;
        displayMedia(data.results, mediaType);
    } catch (error) {
        mediaGrid.innerHTML = `<div class="col-span-full text-center text-red-500"><p>Failed to load content.</p></div>`;
    }
}

async function fetchMoreMedia() {
    if (isLoading || currentPage >= totalPages) return;
    isLoading = true;
    infiniteLoader.style.display = 'flex';
    currentPage++;
    try {
        const fullUrl = getFullApiUrl(currentApiUrl, currentPage);
        const res = await fetch(fullUrl);
        const data = await res.json();
        appendMedia(data.results, currentMediaType);
    } catch (error) {
        console.error("Failed to load more content", error);
    } finally {
        isLoading = false;
        infiniteLoader.style.display = 'none';
    }
}

function showGridView() {
    watchPage.style.display = 'none';
    mainContent.style.display = 'block';
    watchIframe.src = ""; // Stop video playback
}

async function showWatchPage(mediaId, mediaType) {
    mainContent.style.display = 'none';
    watchPage.style.display = 'block';
    watchPage.scrollTop = 0;
    watchIframe.src = "about:blank";
    mediaDetails.innerHTML = '<div class="loader mx-auto"></div>';
    recommendationsGrid.innerHTML = '<div class="loader mx-auto"></div>';
    tvSeasonSelector.style.display = 'none';
    tvSeasonSelector.innerHTML = '';
    
    if (mediaType === 'movie') {
        watchIframe.src = `${STREAM_BASE_URLS.movie}${mediaId}`;
    }
    
    const mediaData = await fetchMediaDetails(mediaId, mediaType);
    if (mediaData) {
        if (mediaType === 'tv') {
            displaySeasonSelector(mediaData, mediaId);
            // Default to S1E1 on initial load
            watchIframe.src = `${STREAM_BASE_URLS.tv}${mediaId}&season=1&episode=1`;
        }
        await fetchRecommendations(mediaId, mediaType, mediaData.genres);
    }
}

async function fetchMediaDetails(mediaId, mediaType) {
    const url = `${BASE_URL}/${mediaType}/${mediaId}?api_key=${API_KEY}&append_to_response=credits,production_countries`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        displayMediaDetails(data);
        return data;
    } catch (error) {
        mediaDetails.innerHTML = `<p class="text-red-500">Could not load details.</p>`;
        return null;
    }
}

async function fetchRecommendations(mediaId, mediaType, genres) {
    const url = `${BASE_URL}/${mediaType}/${mediaId}/recommendations?api_key=${API_KEY}`;
    try {
        let res = await fetch(url);
        let data = await res.json();
        if (data.results.length === 0 && genres && genres.length > 0) {
            const firstGenreId = genres[0].id;
            recommendationTitle.textContent = `Similar in ${genres[0].name}`;
            const fallbackUrl = `${BASE_URL}/discover/${mediaType}?api_key=${API_KEY}&with_genres=${firstGenreId}&sort_by=popularity.desc`;
            res = await fetch(fallbackUrl);
            data = await res.json();
            const filteredResults = data.results.filter(item => item.id != mediaId);
            displayRecommendations(filteredResults, mediaType);
        } else {
            recommendationTitle.textContent = 'You may also like';
            displayRecommendations(data.results, mediaType);
        }
    } catch (error) {
        recommendationsGrid.innerHTML = `<p class="text-red-500">Could not load recommendations.</p>`;
    }
}

async function fetchAndDisplayGenres() {
    const url = `${BASE_URL}/genre/movie/list?api_key=${API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        genreList.innerHTML = data.genres.map(genre => 
            `<a href="#" class="flex items-center p-2 mt-1 rounded-lg hover:bg-gray-800 category-link genre-link" data-genre-id="${genre.id}" data-genre-name="${genre.name}">
                <span class="font-medium text-sm">${genre.name}</span>
            </a>`
        ).join('');
        document.querySelectorAll('.genre-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                handleCategoryClick(link);
                const genreId = link.dataset.genreId;
                const genreName = link.dataset.genreName;
                const url = `${BASE_URL}/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`;
                fetchMedia(url, `${genreName} Movies`, 'movie');
            });
        });
    } catch (error) {
        genreList.innerHTML = `<p class="p-3 text-red-500 text-xs">Could not load genres.</p>`;
    }
}


// --- UI Display Functions ---

function displayMedia(mediaItems, mediaType) {
    mediaGrid.innerHTML = '';
    // Filter out people from search results, if any
    const validMedia = mediaItems.filter(item => item.media_type !== 'person');
    if (validMedia.length === 0) {
        mediaGrid.innerHTML = `<p class="col-span-full text-center text-gray-400">No results found.</p>`;
        return;
    }
    appendMedia(validMedia, mediaType);
}

function appendMedia(mediaItems, mediaType) {
    const mediaHtml = mediaItems.map(item => createMediaCard(item, item.media_type || mediaType)).join('');
    mediaGrid.insertAdjacentHTML('beforeend', mediaHtml);
    document.querySelectorAll('.media-card').forEach(card => {
        if (!card.hasClickListener) {
            card.addEventListener('click', () => {
                const mediaId = card.dataset.mediaId;
                const type = card.dataset.mediaType;
                showWatchPage(mediaId, type);
            });
            card.hasClickListener = true;
        }
    });
}

function createMediaCard(item, mediaType) {
    const title = item.title || item.name;
    const poster = item.poster_path ? IMG_URL + item.poster_path : 'https://placehold.co/500x750/0f0f0f/ffffff?text=No+Image';
    return `
        <div class="flex flex-col cursor-pointer media-card group" data-media-id="${item.id}" data-media-type="${mediaType}">
            <div class="relative overflow-hidden rounded-md sm:rounded-lg shadow-lg">
                <img src="${poster}" alt="${title}" class="w-full h-auto object-cover aspect-[2/3] group-hover:opacity-90 transition-opacity" onerror="this.src='https://placehold.co/500x750/0f0f0f/ffffff?text=Error';">
                <div class="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black bg-opacity-80 text-white text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full">${item.vote_average.toFixed(1)}</div>
            </div>
            <h3 class="text-xs sm:text-sm md:text-base font-medium leading-tight text-gray-200 mt-1.5 sm:mt-2 line-clamp-2">${title}</h3>
        </div>`;
}

function displayMediaDetails(data) {
    const title = data.title || data.name;
    const releaseDate = data.release_date || data.first_air_date;
    const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
    const country = data.production_countries && data.production_countries.length > 0 ? data.production_countries[0].name : '';
    const genres = data.genres.map(genre => `<span class="bg-gray-800 px-2 py-1 rounded-md text-xs">${genre.name}</span>`).join(' ');

    mediaDetails.innerHTML = `
        <h1 class="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-2">${title}</h1>
        <div class="flex items-center flex-wrap gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm text-gray-400">
            <span class="flex items-center">
                <svg class="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                ${data.vote_average.toFixed(1)}
            </span>
            <span>${year}</span>
            ${country ? `<span>${country}</span>` : ''}
        </div>
        <div class="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">${genres}</div>
        <p class="text-xs sm:text-sm text-gray-400 leading-relaxed">${data.overview}</p>
    `;
}

function displayRecommendations(mediaItems, mediaType) {
    if (mediaItems.length === 0) {
        recommendationsGrid.innerHTML = `<p class="text-gray-500 text-sm">No recommendations available.</p>`;
        return;
    }
    recommendationsGrid.innerHTML = mediaItems.slice(0, 10).map(item => {
        const title = item.title || item.name;
        const releaseDate = item.release_date || item.first_air_date;
        const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
        const imagePath = item.backdrop_path ? IMG_URL + item.backdrop_path : (item.poster_path ? IMG_URL + item.poster_path : 'https://placehold.co/320x180/0f0f0f/ffffff?text=N/A');
        
        return `
            <div class="flex items-start space-x-2 sm:space-x-3 cursor-pointer p-1.5 sm:p-2 rounded-lg recommendation-card hover:bg-gray-800" data-media-id="${item.id}" data-media-type="${mediaType}">
                <img src="${imagePath}" alt="${title}" class="w-24 sm:w-28 md:w-32 flex-shrink-0 h-auto object-cover rounded-md aspect-video">
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2">${title}</h4>
                    <p class="text-gray-400 text-xs mt-0.5 sm:mt-1">${year}</p>
                </div>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.recommendation-card').forEach(card => {
        card.addEventListener('click', () => {
            const mediaId = card.dataset.mediaId;
            const type = card.dataset.mediaType;
            showWatchPage(mediaId, type);
        });
    });
}

function displaySeasonSelector(seriesData, seriesId) {
    tvSeasonSelector.style.display = 'block';
    const seasons = seriesData.seasons.filter(s => s.episode_count > 0 && s.season_number > 0);
    
    let seasonOptionsHtml = seasons.map(season => 
        `<option value="${season.season_number}" data-episode-count="${season.episode_count}">${season.name}</option>`
    ).join('');

    tvSeasonSelector.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            <h4 class="text-sm sm:text-base lg:text-lg font-semibold text-gray-300">Episodes</h4>
            <select id="season-dropdown" class="bg-gray-800 border border-gray-700 text-white text-xs sm:text-sm rounded-lg focus:ring-red-500 focus:border-red-500 p-2 w-full sm:w-auto">
                ${seasonOptionsHtml}
            </select>
        </div>
        <div id="episode-list-container" class="pb-2"></div>
    `;

    const seasonDropdown = document.getElementById('season-dropdown');
    seasonDropdown.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const episodeCount = parseInt(selectedOption.dataset.episodeCount);
        displayEpisodeList(seriesId, e.target.value, episodeCount);
    });

    if (seasons.length > 0) {
        displayEpisodeList(seriesId, seasons[0].season_number, seasons[0].episode_count);
    }
}

function displayEpisodeList(seriesId, seasonNumber, episodeCount) {
    const container = document.getElementById('episode-list-container');
    let episodeButtonsHtml = '';
    for (let i = 1; i <= episodeCount; i++) {
        episodeButtonsHtml += `<button class="episode-btn flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 text-xs sm:text-sm flex items-center justify-center font-medium text-gray-300 bg-gray-800 rounded-md border-2 border-transparent hover:bg-gray-700" data-episode-number="${i}">${i}</button>`;
    }
    container.innerHTML = `<div class="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">${episodeButtonsHtml}</div>`;

    const episodeButtons = container.querySelectorAll('.episode-btn');
    episodeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            episodeButtons.forEach(b => b.classList.remove('btn-active'));
            btn.classList.add('btn-active');
            watchIframe.src = `${STREAM_BASE_URLS.tv}${seriesId}&season=${seasonNumber}&episode=${btn.dataset.episodeNumber}`;
        });
    });

    if(episodeButtons.length > 0) {
        episodeButtons[0].click();
    }
}


// --- Event Listeners & Handlers ---
function handleCategoryClick(linkElement) {
    document.querySelectorAll('.category-link').forEach(l => l.classList.remove('bg-gray-800'));
    linkElement.classList.add('bg-gray-800');
    closeGenreDropdown();
    if (window.innerWidth < 1024) closeSidebar();
}

function closeGenreDropdown() {
    if (!genreList.style.maxHeight || genreList.style.maxHeight === '0px') return;
    genreArrow.classList.remove('rotate-180');
    genreList.style.maxHeight = '0px';
}

mainContent.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = mainContent;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
        fetchMoreMedia();
    }
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    searchTimeout = setTimeout(() => {
        document.querySelectorAll('.category-link').forEach(l => l.classList.remove('bg-gray-800'));
        closeGenreDropdown();
        if (searchTerm) {
            const url = `${BASE_URL}/search/multi?query=${encodeURIComponent(searchTerm)}`;
            fetchMedia(url, `Results for "${searchTerm}"`, 'multi');
        } else {
            document.querySelector('.category-link[data-category="popular"][data-type="movie"]').click();
        }
    }, 500);
});

document.querySelectorAll('.category-link[data-category]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        handleCategoryClick(link);
        const category = link.dataset.category;
        const mediaType = link.dataset.type;
        const title = link.querySelector('span').textContent;
        const url = `${BASE_URL}/${mediaType}/${category}`;
        fetchMedia(url, title, mediaType);
    });
});

genreDropdownBtn.addEventListener('click', () => {
    genreArrow.classList.toggle('rotate-180');
    genreList.style.maxHeight = genreList.style.maxHeight && genreList.style.maxHeight !== '0px' ? '0px' : genreList.scrollHeight + "px";
});

homeLogoButton.addEventListener('click', () => {
    document.querySelector('.category-link[data-category="popular"][data-type="movie"]').click();
});

// --- Mobile Sidebar Logic ---
function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
}
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}
menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth < 1024) {
        // Mobile logic
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    } else {
        // Desktop logic
        sidebar.classList.toggle('desktop-collapsed');
    }
});
overlay.addEventListener('click', closeSidebar);

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.category-link[data-category="popular"][data-type="movie"]').click();
    fetchAndDisplayGenres();
});
