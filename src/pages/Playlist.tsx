import { HeartFillIcon, HeartIcon } from '@primer/octicons-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { InlineLoader } from '../components/InlineLoader'
import { JellyImg } from '../components/JellyImg'
import { Loader } from '../components/Loader'
import { DownloadIndicators } from '../components/MediaList'
import { PlaylistTrackList } from '../components/PlaylistTrackList'
import { Squircle } from '../components/Squircle'
import { MoreIcon, SearchClearIcon, SearchIcon } from '../components/SvgIcons'
import { useDropdownContext } from '../context/DropdownContext/DropdownContext'
import { usePageTitle } from '../context/PageTitleContext/PageTitleContext'
import { usePlaybackContext } from '../context/PlaybackContext/PlaybackContext'
import { useJellyfinPlaylistData } from '../hooks/Jellyfin/Infinite/useJellyfinPlaylistData'
import { useJellyfinSearch } from '../hooks/Jellyfin/useJellyfinSearch'
import { useFavorites } from '../hooks/useFavorites'
import { formatDate } from '../utils/formatDate'
import { formatDurationReadable } from '../utils/formatDurationReadable'
import './Playlist.css'

export const Playlist = () => {
    const playback = usePlaybackContext()
    const { addToFavorites, removeFromFavorites } = useFavorites()

    const { playlistId } = useParams<{ playlistId: string }>()
    const {
        playlistData,
        items: tracks,
        infiniteData,
        isLoading,
        error,
        totalPlaytime,
        totalTrackCount,
        totalPlays,
        reviver,
        loadMore,
    } = useJellyfinPlaylistData(playlistId!)

    const { setPageTitle } = usePageTitle()
    const { isOpen, selectedItem, onContextMenu } = useDropdownContext()

    useEffect(() => {
        if (playlistData) {
            setPageTitle(playlistData.Name)
        }
        return () => {
            setPageTitle('')
        }
    }, [playlistData, setPageTitle])

    const [searchQuery, setSearchQuery] = useState('')
    const { /*searchResults,*/ searchLoading } = useJellyfinSearch(searchQuery)

    const filteredTracks = searchQuery
        ? tracks.filter(item => item.Type === 'Audio' && item.Name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : tracks

    const handleClearSearch = () => {
        setSearchQuery('')
    }

    if (isLoading && tracks.length === 0) {
        return <Loader />
    }

    if (error) {
        return <div className="error">{error || 'Playlist not found'}</div>
    }

    if (!playlistData) {
        return <div className="error">No tracks were found</div>
    }

    const handleMoreClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation()
        onContextMenu(e, { item: playlistData }, true, { add_to_favorite: true, remove_from_favorite: true })
    }

    return (
        <div className="playlist-page">
            <div className="playlist-header">
                <Squircle width={100} height={100} cornerRadius={8} className="thumbnail">
                    <JellyImg item={playlistData} type={'Primary'} width={100} height={100} />
                </Squircle>
                <div className="playlist-details">
                    <div className="title">{playlistData.Name}</div>
                    <div className="date">{formatDate(playlistData.DateCreated)}</div>
                    <div className="stats">
                        <div className="track-amount">
                            <span className="number">{totalTrackCount}</span>{' '}
                            <span>{totalTrackCount === 1 ? 'Track' : 'Tracks'}</span>
                        </div>
                        <div className="divider"></div>
                        <div className="length">
                            <span className="number">{formatDurationReadable(totalPlaytime)}</span> <span>Total</span>
                        </div>
                        {totalPlays > 0 && (
                            <>
                                <div className="divider"></div>
                                <div className="plays">
                                    <span className="number">{totalPlays}</span> {totalPlays === 1 ? 'Play' : 'Plays'}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="actions noSelect">
                        <div className="primary">
                            <div
                                className="play-playlist"
                                onClick={() => {
                                    const tracksToPlay = searchQuery ? filteredTracks : tracks
                                    if (
                                        playback.setCurrentPlaylistSimple({
                                            playlist: tracksToPlay,
                                            title: playlistData.Name,
                                        })
                                    ) {
                                        playback.playTrack(0)
                                    }
                                }}
                            >
                                <div className="play-icon" />
                                <div className="text">Play</div>
                            </div>
                            <div
                                className="favorite-state"
                                title={playlistData.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                onClick={async () => {
                                    if (playlistData?.Id) {
                                        try {
                                            if (playlistData.UserData?.IsFavorite) {
                                                await removeFromFavorites(playlistData)
                                            } else {
                                                await addToFavorites(playlistData)
                                            }
                                        } catch (error) {
                                            console.error('Failed to update favorite status:', error)
                                        }
                                    }
                                }}
                            >
                                {playlistData.UserData?.IsFavorite ? (
                                    <HeartFillIcon size={16} />
                                ) : (
                                    <HeartIcon size={16} />
                                )}
                            </div>
                        </div>
                        <div className="secondary">
                            <div className="input_container">
                                {!searchLoading && !searchQuery && (
                                    <div className="search-icon noSelect">
                                        <SearchIcon width={12} height={12} />
                                    </div>
                                )}

                                {searchLoading && (
                                    <div className="search-loading noSelect">
                                        <InlineLoader />
                                    </div>
                                )}

                                {!searchLoading && searchQuery && (
                                    <div className="search-clear" onClick={handleClearSearch}>
                                        <SearchClearIcon width={12} height={12} />
                                    </div>
                                )}

                                <input
                                    type="search"
                                    placeholder="Filter tracks"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    //onChange={handleSearchChange}
                                    //ref={searchInputRef}
                                />
                                <DownloadIndicators
                                    offlineState={playlistData.offlineState}
                                    size={16}
                                    itemId={playlistData.Id}
                                />
                                <div
                                    className={`more ${isOpen && selectedItem?.Id === playlistData?.Id ? 'active' : ''}`}
                                    onClick={handleMoreClick}
                                    title="More"
                                >
                                    <MoreIcon width={14} height={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PlaylistTrackList
                tracks={filteredTracks}
                infiniteData={searchQuery ? undefined : infiniteData}
                isLoading={searchQuery ? searchLoading : isLoading}
                showType="artist"
                playlistId={playlistId}
                title={playlistData ? playlistData.Name : 'Playlist'}
                reviver={reviver}
                loadMore={searchQuery ? undefined : loadMore}
            />
        </div>
    )
}
