@extends('adminConsole.layout.app')

@section('content')

<h4 class="mb-4"><i class="fa-solid fa-arrow-down-wide-short me-1"></i>Menu Serialization</h4>

<div class="tab-wrapper mb-4">

    <div class="tab-slider {{ request()->get('tab') == 'view' ? 'right' : 'left' }}"></div>

    <a href="?tab=add"
       class="tab-item {{ request()->get('tab') != 'view' ? 'active' : '' }}">
        <i class="fa fa-sort me-1"></i> Add Serialization
    </a>

    <a href="?tab=view"
       class="tab-item {{ request()->get('tab') == 'view' ? 'active' : '' }}">
        <i class="fa fa-list me-1"></i> View Serialization
    </a>

</div>

<div class="content-card">

    @if(request()->get('tab') == 'view')
        @include('adminConsole.menuSerialization.viewSerialization')
    @else
        @include('adminConsole.menuSerialization.addSerialization')
    @endif

</div>

@endsection
